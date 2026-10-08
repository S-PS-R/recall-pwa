import type { CardInput } from '../../domain/types';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_CARDS = 5000;
export const MAX_FILES = 20;
export interface ParseIssue { line: number; message: string }
export interface ParseResult { cards: CardInput[]; issues: ParseIssue[]; duplicates: number; blankLines: number; fatal?: string }

/** First tab separates sides; subsequent tabs remain in the definition. Only outer whitespace is trimmed. */
export function parseTsv(text: string): ParseResult {
  const result: ParseResult = { cards: [], issues: [], duplicates: 0, blankLines: 0 };
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) return { ...result, fatal: 'File exceeds 2 MB. Split it into smaller files.' };
  const seen = new Set<string>();
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  let rows = 0;
  for (const [index, raw] of lines.entries()) {
    if (!raw.trim()) { result.blankLines++; continue; }
    if (++rows > MAX_CARDS) return { ...result, cards: [], fatal: 'File exceeds 5,000 nonempty rows. Split it into smaller files.' };
    const tab = raw.indexOf('\t');
    if (tab === -1) { result.issues.push({ line: index + 1, message: 'Missing tab. Separate the term and definition with a tab, not a comma.' }); continue; }
    const front = raw.slice(0, tab).trim(), back = raw.slice(tab + 1).trim();
    if (!front || !back) { result.issues.push({ line: index + 1, message: !front ? 'Term is empty. Add text before the tab.' : 'Definition is empty. Add text after the tab.' }); continue; }
    const key = JSON.stringify([front, back]);
    if (seen.has(key)) { result.duplicates++; continue; }
    seen.add(key);
    result.cards.push({ front, back });
  }
  if (!rows) result.fatal = 'File is empty. Add a term, a tab, and a definition on each line.';
  else if (!result.cards.length) result.fatal = 'No valid cards found. Fix the row errors and choose the file again.';
  return result;
}

export async function readImportFile(file: File): Promise<ParseResult> {
  const empty = { cards: [], issues: [], duplicates: 0, blankLines: 0 };
  if (!/\.(txt|tsv)$/i.test(file.name)) return { ...empty, fatal: 'Choose a .txt or .tsv file.' };
  if (file.size > MAX_FILE_BYTES) return { ...empty, fatal: 'File exceeds 2 MB. Split it into smaller files.' };
  try { return parseTsv(await file.text()); }
  catch { return { ...empty, fatal: 'Could not read this file. Download a local copy in Files, then try again.' }; }
}
