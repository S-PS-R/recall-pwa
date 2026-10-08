import { test, expect, type Page } from '@playwright/test';

async function importSet(page: Page, content = 'नमस्ते\tHello\nलड़का\tBoy\nलड़की\tGirl') {
  await page.goto('./');
  await page.getByLabel('Choose flashcard files').setInputFiles({ name: 'Study.txt', mimeType: 'text/plain', buffer: Buffer.from(content) });
  await page.getByRole('button', { name: /^Import \d+ cards$/ }).click();
  await page.getByRole('link', { name: 'Study this set' }).click();
}

test('flashcards flip, navigate, reverse, shuffle and resume offline', async ({ page, context }, testInfo) => {
  await importSet(page);
  await page.getByRole('button', { name: 'Start Flashcards', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toContainText('नमस्ते');
  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show prompt', exact: true })).toContainText('Hello');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toContainText('लड़का');
  await page.getByRole('button', { name: 'Reverse direction' }).click();
  await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toContainText('Boy');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toContainText('Boy');
  await page.locator('main').focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Show prompt', exact: true })).toContainText('लड़का');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toContainText('Hello');
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
  await expect(page.getByText('CARD 1 OF 3', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-flashcards.png`, fullPage: true });
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(page.getByText('SESSION COMPLETE', { exact: true })).toBeVisible();
});

test('Learn retries a tiny set, persists feedback, and scores first attempts separately', async ({ page }, testInfo) => {
  await importSet(page, 'नमस्ते\tHello');
  await page.getByRole('button', { name: /^Learn Practice/ }).click();
  await page.getByRole('combobox', { name: 'Question style' }).selectOption('choice');
  await page.getByRole('button', { name: 'Start Learn', exact: true }).click();
  await page.getByLabel('Your answer', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.getByText('Expected answer:', { exact: false })).toContainText('Hello');
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByText('You’ll see this card again shortly.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Your answer', { exact: true }).fill('  HELLO  ');
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.getByRole('heading', { name: 'That’s right.' })).toBeVisible();
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.locator('.result-score')).toContainText('0 / 1');
  await expect(page.getByText('1 correct across 2 attempts, including retries.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review your mistakes' })).toBeVisible();
  await page.screenshot({ path: `test-results/${testInfo.project.name}-learn-results.png`, fullPage: true });
});

test('Test combines real multiple choice and written questions, no repeats, with final error review', async ({ page }, testInfo) => {
  await importSet(page);
  await page.getByRole('button', { name: /^Test Check/ }).click();
  await page.getByRole('combobox', { name: 'Answer matching' }).selectOption('strict');
  await page.getByRole('button', { name: 'Start Test', exact: true }).click();
  const meanings: Record<string, string> = { 'नमस्ते': 'Hello', 'लड़का': 'Boy', 'लड़की': 'Girl' };
  const prompts: string[] = [];
  for (let index = 0; index < 3; index++) {
    const prompt = await page.locator('.question-prompt').innerText(); prompts.push(prompt);
    if (index === 1) {
      await page.getByLabel('Your answer', { exact: true }).fill('wrong');
      await page.getByRole('button', { name: 'Submit answer' }).click();
    } else {
      await expect(page.locator('.answer-choice')).toHaveCount(3);
      await page.screenshot({ path: `test-results/${testInfo.project.name}-test-question.png`, fullPage: true });
      await page.locator('.answer-choice').filter({ hasText: meanings[prompt] }).click();
    }
    if (index < 2) await expect(page.getByText(`QUESTION ${index + 2} OF 3`, { exact: true })).toBeVisible();
  }
  expect(new Set(prompts).size).toBe(3);
  await expect(page.locator('.result-score')).toContainText('2 / 3');
  await expect(page.locator('.mistake')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'View results' }).click();
  await expect(page.locator('.result-score')).toContainText('67%');
});
