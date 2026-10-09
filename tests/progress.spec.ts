import { test, expect, type Page } from '@playwright/test';
async function setup(page: Page, text = 'नमस्ते\tHello') {
  await page.goto('./');
  await page.getByLabel('Choose flashcard files').setInputFiles({ name: 'Review.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
  await page.getByRole('button', { name: /^Import \d+ cards$/ }).click();
  await page.getByRole('link', { name: 'Study this set' }).click();
}
test('ratings persist, due queue advances by time, and mastery requires spaced reviews', async ({ page, context }, testInfo) => {
  const start = Date.parse('2026-10-08T12:00:00Z');
  await page.clock.setFixedTime(start);
  await setup(page);
  const studyUrl = page.url();
  for (const elapsedDays of [0, 1, 4]) {
    await page.clock.setFixedTime(start + elapsedDays * 86400000);
    await page.goto(studyUrl); await page.reload();
    if (elapsedDays) {
      await expect(page.getByRole('link', { name: 'Review 1 due cards' })).toBeVisible();
      await page.getByRole('link', { name: 'Review 1 due cards' }).click();
      await expect(page.getByRole('heading', { name: 'Due-card review' })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Start Flashcards', exact: true }).click();
    await page.getByRole('button', { name: 'Show answer', exact: true }).click();
    await page.getByRole('button', { name: 'Rate good', exact: true }).click();
    await expect(page.getByText(/Rated good\./)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rate good', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Finish session' }).click();
  }
  await page.goto('./#progress');
  await expect(page.getByRole('progressbar', { name: 'Library mastery' })).toHaveAttribute('value', '1');
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await expect(page.getByText('No answers yet', { exact: true })).toBeVisible();
  await expect(page.locator('.activity-row')).toHaveCount(3);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true); await page.reload();
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/${testInfo.project.name}-progress.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('case and punctuation are accepted in strict Learn, compact feedback advances with Enter', async ({ page }, testInfo) => {
  await setup(page, 'नमस्ते\tHello!\nकैसे हो\tHow are you?');
  await page.getByRole('button', { name: /^Learn Practice/ }).click();
  await page.getByRole('combobox', { name: 'Question style' }).selectOption('written');
  await page.getByRole('combobox', { name: 'Answer matching' }).selectOption('strict');
  await page.getByRole('button', { name: 'Start Learn', exact: true }).click();
  for (let index = 0; index < 2; index++) {
    const prompt = await page.locator('.question-prompt').innerText();
    await page.getByLabel('Your answer', { exact: true }).fill(prompt === 'नमस्ते' ? 'HELLO' : 'HOW ARE YOU');
    await page.getByRole('button', { name: 'Submit answer' }).click();
    await expect(page.getByRole('heading', { name: 'That’s right.' })).toBeVisible();
    await expect(page.getByText('Expected answer:', { exact: false })).toHaveCount(0);
    if (index === 0) {
      await expect(page.getByRole('button', { name: 'Next question', exact: true })).toBeVisible();
      await page.screenshot({ path: `test-results/${testInfo.project.name}-correct-feedback.png`, fullPage: true });
    }
    await page.keyboard.press('Enter');
  }
  await expect(page.getByText('SESSION COMPLETE', { exact: true })).toBeVisible();
  await page.goto('./#progress');
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Library mastery' })).toHaveAttribute('value', '0');
  await expect(page.locator('.activity-row')).toHaveCount(2);
  await page.goto('./#settings'); await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
  await page.goto('./#progress');
  await page.screenshot({ path: `test-results/${testInfo.project.name}-progress-dark.png`, fullPage: true });
});
