import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    speechTest: {
      calls: { text: string; rate: number; lang: string; voice: string }[];
      cancellations: number;
      fail: () => void;
      finish: () => void;
      load: () => void;
    };
  }
}

async function mockSpeech(page: Page, availability: 'local' | 'delayed' | 'remote' | 'unsupported' = 'local') {
  await page.addInitScript(mode => {
    if (mode === 'unsupported') { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); return; }
    let loaded = mode === 'local';
    let current: SpeechSynthesisUtterance | undefined;
    const events = new EventTarget();
    const remote = { name: 'Remote English', lang: 'en-US', default: true, localService: false };
    const local = { name: 'Device English', lang: 'en-GB', default: false, localService: true };
    window.speechTest = {
      calls: [], cancellations: 0,
      fail: () => current?.onerror?.(new Event('error') as SpeechSynthesisErrorEvent),
      finish: () => current?.onend?.(new Event('end') as SpeechSynthesisEvent),
      load: () => { loaded = true; events.dispatchEvent(new Event('voiceschanged')); },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => loaded ? [remote, local] : [remote],
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      speak: (utterance: SpeechSynthesisUtterance) => {
        current = utterance;
        window.speechTest.calls.push({ text: utterance.text, rate: utterance.rate, lang: utterance.lang, voice: utterance.voice?.name ?? '' });
      },
      cancel: () => { window.speechTest.cancellations++; },
    } });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class {
      text: string;
      constructor(text: string) { this.text = text; }
    } });
  }, availability);
}

async function start(page: Page) {
  await page.goto('./');
  await page.getByLabel('Choose flashcard files').setInputFiles({ name: 'Speaking.txt', mimeType: 'text/plain', buffer: Buffer.from('नमस्ते\tHello\nलड़का\tBoy') });
  await page.getByRole('button', { name: 'Import 2 cards', exact: true }).click();
  await page.getByRole('link', { name: 'Study this set' }).click();
  await page.getByRole('button', { name: 'Start speaking practice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toContainText('Hello');
}

test('English playback leaves Hindi hidden, self-ratings persist and speaking resumes offline', async ({ page, context }, testInfo) => {
  await mockSpeech(page);
  await start(page);
  await expect(page.getByText('नमस्ते', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.speechTest.calls)).toEqual([]);
  await page.getByRole('button', { name: 'Read English', exact: true }).click();
  expect(await page.evaluate(() => window.speechTest.calls)).toEqual([{ text: 'Hello', rate: 1, lang: 'en-GB', voice: 'Device English' }]);
  await expect(page.getByRole('button', { name: 'Rate good', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop reading' }).click();
  await expect(page.getByRole('button', { name: 'Stop reading' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Read slowly' }).click();
  expect(await page.evaluate(() => window.speechTest.calls.at(-1)?.rate)).toBe(0.75);
  const beforeFlip = await page.evaluate(() => window.speechTest.cancellations);
  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show prompt', exact: true })).toContainText('नमस्ते');
  expect(await page.evaluate(() => window.speechTest.cancellations)).toBeGreaterThan(beforeFlip);
  // An event from canceled playback must not put an error on the next card.
  await page.evaluate(() => window.speechTest.fail());
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rate good', exact: true }).click();
  await expect(page.getByText(/Rated good\./)).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByText(/Rated good\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rate good', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Read English', exact: true }).click();
  expect(await page.evaluate(() => window.speechTest.calls.at(-1)?.text)).toBe('Boy');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-speaking.png`, fullPage: true });
  const beforePause = await page.evaluate(() => window.speechTest.cancellations);
  await page.getByRole('button', { name: 'Pause session' }).click();
  expect(await page.evaluate(() => window.speechTest.cancellations)).toBeGreaterThan(beforePause);
});

test('late device voices load, playback errors allow retry, navigation and reversing stop speech', async ({ page }) => {
  await mockSpeech(page, 'delayed');
  await start(page);
  await page.getByRole('button', { name: 'Read English', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No local English voice');
  expect(await page.evaluate(() => window.speechTest.calls)).toEqual([]);
  await page.evaluate(() => window.speechTest.load());
  await page.getByRole('button', { name: 'Read English', exact: true }).click();
  await page.evaluate(() => window.speechTest.fail());
  await expect(page.getByRole('alert')).toContainText('Could not play the voice');
  await page.getByRole('button', { name: 'Read English', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const beforeNext = await page.evaluate(() => window.speechTest.cancellations);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  expect(await page.evaluate(() => window.speechTest.cancellations)).toBeGreaterThan(beforeNext);
  await expect(page.getByRole('button', { name: 'Stop reading' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Read English', exact: true }).click();
  const beforeReverse = await page.evaluate(() => window.speechTest.cancellations);
  await page.getByRole('button', { name: 'Reverse direction' }).click();
  await expect(page.getByRole('region', { name: 'Speaking practice' })).toHaveCount(0);
  expect(await page.evaluate(() => window.speechTest.cancellations)).toBeGreaterThan(beforeReverse);
});

for (const mode of ['remote', 'unsupported'] as const) {
  test(`${mode} speech availability still permits revealing and self-rating`, async ({ page }) => {
    await mockSpeech(page, mode);
    await start(page);
    if (mode === 'remote') {
      await page.getByRole('button', { name: 'Read English', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('No local English voice');
      expect(await page.evaluate(() => window.speechTest.calls)).toEqual([]);
    } else {
      await expect(page.getByText('This browser does not support reading aloud.', { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Read English', exact: true })).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Show answer', exact: true }).click();
    await page.getByRole('button', { name: 'Rate again', exact: true }).click();
    await expect(page.getByText(/Rated again\./)).toBeVisible();
  });
}
