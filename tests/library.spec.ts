import { test, expect } from '@playwright/test';

test('imports multiple files with validation, preserves Unicode, persists and starts offline', async ({ page, context }) => {
  const uploads: string[] = [];
  const external: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') uploads.push(request.url()); if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible();
  await page.getByLabel('Choose flashcard files').setInputFiles([
    { name: 'Hindi.txt', mimeType: 'text/plain', buffer: Buffer.from('\uFEFFनमस्ते\tHello\r\nनमस्ते\tHello\r\nलड़का\tBoy\r\nbad row') },
    { name: 'Phrases.tsv', mimeType: 'text/tab-separated-values', buffer: Buffer.from('क्या हाल है?\tHow are you?') },
  ]);
  await expect(page.getByText('1 duplicates skipped')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import 3 cards in 2 sets' })).toBeDisabled();
  await page.getByText('Row errors (1)').click();
  await expect(page.getByText(/Line 4: Missing tab/)).toBeVisible();
  await page.getByLabel('Import valid cards and skip the 1 invalid row(s).').check();
  await page.getByRole('button', { name: 'Import 3 cards in 2 sets' }).click();
  await expect(page.getByRole('heading', { name: 'Hindi', exact: true })).toBeVisible();
  await expect(page.getByText('नमस्ते', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('लड़का', { exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hindi', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Phrases', exact: true })).toBeVisible();
  expect(uploads).toEqual([]); expect(external).toEqual([]);
});

test('creates, edits, reorders, confirms removal and deletes a set', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Create your first set' }).click();
  await page.getByLabel('Set title', { exact: true }).fill('My own cards');
  await page.getByLabel('Card 1 term', { exact: true }).fill('नमस्ते');
  await page.getByLabel('Card 1 definition', { exact: true }).fill('Hello');
  await page.getByRole('button', { name: 'Add card', exact: true }).click();
  await page.getByLabel('Card 2 term', { exact: true }).fill('धन्यवाद');
  await page.getByLabel('Card 2 definition', { exact: true }).fill('Thank you');
  await page.getByRole('button', { name: 'Save study set' }).click();
  await expect(page.getByRole('heading', { name: 'My own cards', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit set' }).click();
  await page.getByRole('button', { name: 'Move card 2 up' }).click();
  await expect(page.getByLabel('Card 1 term', { exact: true })).toHaveValue('धन्यवाद');
  await page.getByRole('button', { name: 'Remove card 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save study set' })).toBeDisabled();
  await page.getByLabel('Remove 1 saved card(s) and their review progress when I save.').check();
  await page.getByLabel('Set title', { exact: true }).fill('Edited set');
  await page.getByRole('button', { name: 'Save study set' }).click();
  await expect(page.getByRole('heading', { name: 'Edited set' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('धन्यवाद', { exact: true })).toBeVisible();
  await expect(page.getByText('नमस्ते', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete study set' }).click();
  await page.getByRole('button', { name: 'Keep set' }).click();
  await expect(page.getByRole('heading', { name: 'Edited set' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete study set' }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('heading', { name: 'Your next discovery starts here' })).toBeVisible();
});

test('same-source import requires explicit new-set acknowledgment and cancellation saves nothing', async ({ page }) => {
  const file = { name: 'Hindi.txt', mimeType: 'text/plain', buffer: Buffer.from('नमस्ते\tHello') };
  await page.goto('./');
  await page.getByLabel('Choose flashcard files').setInputFiles(file);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next discovery starts here' })).toBeVisible();
  await page.getByLabel('Choose flashcard files').setInputFiles(file);
  await page.getByRole('button', { name: 'Import 1 cards', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hindi', exact: true })).toBeVisible();
  await page.getByLabel('Choose flashcard files').setInputFiles(file);
  await expect(page.getByRole('button', { name: 'Import 1 cards', exact: true })).toBeDisabled();
  await page.getByLabel('Import as a new, separate set. Keep existing sets.').check();
  await page.getByRole('button', { name: 'Import 1 cards', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hindi', exact: true })).toHaveCount(2);
});

test('mobile layout stays inside the viewport and theme persists', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-library.png`, fullPage: true });
  await page.goto('./#settings');
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toHaveValue('dark');
});
