import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
function luminance(hex: string) {
  const rgb = hex.match(/[\da-f]{2}/gi)!.map(value => parseInt(value, 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
it('meets WCAG AA contrast targets for light and dark theme tokens', () => {
  const palettes = [...css.matchAll(/:root[^{}]*\{([^}]+)\}/g)].map(match => Object.fromEntries([...match[1].matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(pair => [pair[1], pair[2]])));
  expect(palettes.length).toBeGreaterThanOrEqual(2);
  for (const colors of palettes) {
    for (const bg of ['bg', 'panel', 'soft']) for (const fg of ['text', 'muted', 'accent', 'success', 'warning']) expect(contrast(colors[fg], colors[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    for (const bg of ['bg', 'panel']) for (const fg of ['border', 'focus']) expect(contrast(colors[fg], colors[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.bg, colors.accent)).toBeGreaterThanOrEqual(4.5);
  }
  for (const selector of ['rating-again', 'rating-hard', 'rating-good', 'rating-easy']) {
    const rule = css.match(new RegExp(`\\.${selector} \\{([^}]+)\\}`))![1];
    const bg = rule.match(/background: (#[\da-f]{6})/)![1];
    const fg = rule.match(/(?:^|;)\s*color: (#[\da-f]{6})/)![1];
    expect(contrast(fg, bg), selector).toBeGreaterThanOrEqual(4.5);
  }
});
