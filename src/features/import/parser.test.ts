import { describe, expect, it } from 'vitest';
import { MAX_CARDS, MAX_FILE_BYTES, parseTsv, readImportFile } from './parser';
describe('tab-separated parser', () => {
  it('handles BOM, CRLF, blank lines, surrounding whitespace and Hindi', () => {
    const result = parseTsv('\uFEFF नमस्ते \t Hello \r\n\r\nक्या हाल है?\tHow are you?\r\n');
    expect(result.cards).toEqual([{ front: 'नमस्ते', back: 'Hello' }, { front: 'क्या हाल है?', back: 'How are you?' }]);
    expect(result.issues).toEqual([]);
    expect(result.blankLines).toBe(2);
  });
  it('reports duplicates but preserves distinct definitions, case and diacritics', () => {
    const result = parseTsv('é\tmeaning\né\tmeaning\né\tother\nÉ\tmeaning\ne\u0301\tmeaning');
    expect(result.duplicates).toBe(1);
    expect(result.cards).toHaveLength(4);
    expect(result.cards[3].front).toBe('e\u0301');
  });
  it('uses first tab only and keeps punctuation and authored tags', () => {
    expect(parseTsv('[My tag] नमस्ते!\tHello, friend!\tAnother note').cards).toEqual([{ front: '[My tag] नमस्ते!', back: 'Hello, friend!\tAnother note' }]);
  });
  it('reports original line numbers and never treats commas as separators', () => {
    const result = parseTsv('\nterm,definition\n\tanswer\nterm\t\nvalid\tanswer');
    expect(result.issues.map(issue => issue.line)).toEqual([2, 3, 4]);
    expect(result.issues.map(issue => issue.message)).toEqual([expect.stringContaining('Missing tab'), expect.stringContaining('Term is empty'), expect.stringContaining('Definition is empty')]);
    expect(result.cards).toEqual([{ front: 'valid', back: 'answer' }]);
  });
  it('rejects empty and entirely invalid files', () => {
    expect(parseTsv('\uFEFF \r\n').fatal).toContain('empty');
    expect(parseTsv('bad row').fatal).toContain('No valid cards');
  });
  it('bounds bytes and rows, including invalid rows', () => {
    expect(parseTsv('a'.repeat(MAX_FILE_BYTES + 1)).fatal).toContain('2 MB');
    const atLimit = Array.from({ length: MAX_CARDS }, (_, i) => `${i}\tvalue`).join('\n');
    expect(parseTsv(atLimit).cards).toHaveLength(MAX_CARDS);
    expect(parseTsv(atLimit + '\nextra\tvalue').cards).toEqual([]);
    expect(parseTsv('bad\n'.repeat(MAX_CARDS + 1)).fatal).toContain('5,000');
  });
  it('rejects oversized files before reading and handles read failure', async () => {
    const huge = { name: 'huge.txt', size: MAX_FILE_BYTES + 1, text: () => { throw Error('must not read'); } } as unknown as File;
    expect((await readImportFile(huge)).fatal).toContain('2 MB');
    const broken = { name: 'broken.tsv', size: 1, text: async () => { throw Error('provider unavailable'); } } as unknown as File;
    expect((await readImportFile(broken)).fatal).toContain('local copy');
    expect((await readImportFile(new File(['a\tb'], 'wrong.csv'))).fatal).toContain('.txt or .tsv');
    expect((await readImportFile(new File(['a\tb'], 'good.TXT'))).cards).toHaveLength(1);
  });
});
