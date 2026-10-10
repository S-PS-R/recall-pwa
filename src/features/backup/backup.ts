import { db } from '../../db/database';
import { cardKey, type Folder, type StudySet, type Flashcard, type CardProgress, type StudySession, type Setting } from '../../domain/types';
import type { ReviewEvent } from '../../domain/scheduler';

export interface Backup { format: 'recall-library'; version: 1; exportedAt: number; folders: Folder[]; sets: StudySet[]; cards: Flashcard[]; progress: CardProgress[]; sessions: StudySession[]; settings: Setting[]; reviews: ReviewEvent[] }
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
type Check = (value: unknown) => boolean;
const text: Check = v => typeof v === 'string' && v.length <= MAX_BACKUP_BYTES;
const id: Check = v => typeof v === 'string' && !!v.trim() && v.length <= 500;
const nonempty: Check = v => text(v) && !!(v as string).trim();
const num: Check = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
const integer: Check = v => num(v) && Number.isInteger(v);
const bool: Check = v => typeof v === 'boolean';
const optional = (check: Check): Check => v => v === undefined || check(v);
const one = (...values: unknown[]): Check => v => values.includes(v);
const array = (check: Check, max = 100_000): Check => v => Array.isArray(v) && v.length <= max && v.every(check);
const object = (shape: Record<string, Check>): Check => v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.entries(shape).every(([key, check]) => check((v as Record<string, unknown>)[key]));
const rating = one('again', 'hard', 'good', 'easy'), mode = one('flashcards', 'learn', 'test');
const options = object({ direction: one('forward', 'reverse'), comparison: one('strict', 'lenient'), questionMode: one('mixed', 'choice', 'written'), count: v => integer(v) && (v as number) >= 1 && (v as number) <= 5000 });
const answer = object({ cardId: id, prompt: text, expected: text, given: text, correct: bool });
const run = object({ options, questions: array(object({ cardId: id, prompt: nonempty, answer: nonempty, sourceKey: optional(text), accepted: array(nonempty, 5000), kind: one('choice', 'written'), choices: array(text, 4) }), 5000), queue: array(integer, 15000), answers: array(answer, 15000), index: integer, flipped: bool, visited: array(id, 5000), feedback: optional(answer), ratings: optional(array(object({ cardId: id, rating }), 5000)) });
const shapes: Record<string, Check> = {
  folders: object({ id, name: nonempty, parentId: optional(id), createdAt: num, updatedAt: num }),
  sets: object({ id, title: nonempty, folderId: optional(id), description: optional(text), sourceFilename: optional(text), importedAt: optional(num), createdAt: num, updatedAt: num }),
  cards: object({ id, setId: id, front: nonempty, back: nonempty, normalizedKey: text, position: integer, createdAt: num, updatedAt: num }),
  progress: object({ cardId: id, dueAt: optional(num), repetitions: integer, intervalDays: num, easeFactor: optional(num), state: one('new', 'learning', 'review', 'mastered'), lastReviewedAt: optional(num), correctCount: integer, incorrectCount: integer }),
  sessions: object({ id, setId: id, mode, startedAt: num, finishedAt: optional(num), totalQuestions: integer, correctAnswers: integer, revision: optional(integer), run: optional(run) }),
  settings: object({ key: id, value: text }),
  reviews: object({ id, cardId: id, setId: id, sessionId: id, reviewedAt: num, rating, source: mode }),
};
function requireValid(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Invalid backup: ${message}`); }
export function parseBackup(content: string): Backup {
  if (new Blob([content]).size > MAX_BACKUP_BYTES) throw new Error('Backup is larger than the 25 MiB limit.');
  let value: unknown; try { value = JSON.parse(content); } catch { throw new Error('This file is not valid JSON. Choose a Recall library backup.'); }
  requireValid(object({ format: one('recall-library'), version: one(1), exportedAt: num })(value), 'unsupported format or version.');
  const raw = value as Record<string, unknown>;
  for (const [key, check] of Object.entries(shapes)) {
    requireValid(array(check)(raw[key]), `${key} has missing or malformed records.`);
    const records = raw[key] as Record<string, unknown>[];
    const ids = records.map(record => record[key === 'settings' ? 'key' : key === 'progress' ? 'cardId' : 'id']);
    requireValid(new Set(ids).size === ids.length, `duplicate identifiers in ${key}.`);
  }
  const backup = value as Backup;
  const folders = new Map(backup.folders.map(f => [f.id, f]));
  const sets = new Set(backup.sets.map(s => s.id)), cards = new Map(backup.cards.map(c => [c.id, c])), sessions = new Map(backup.sessions.map(s => [s.id, s]));
  for (const folder of backup.folders) {
    const seen = new Set([folder.id]); let parent = folder.parentId;
    while (parent) { requireValid(folders.has(parent) && !seen.has(parent), 'folder hierarchy is broken.'); seen.add(parent); parent = folders.get(parent)?.parentId; }
  }
  for (const set of backup.sets) requireValid(!set.folderId || folders.has(set.folderId), 'set refers to a missing folder.');
  const positions = new Set<string>();
  for (const card of backup.cards) {
    const position = JSON.stringify([card.setId, card.position]);
    requireValid(sets.has(card.setId) && card.normalizedKey === cardKey(card) && !positions.has(position), 'card identity, set, or position is inconsistent.'); positions.add(position);
  }
  const counts = new Map<string, number>();
  for (const card of backup.cards) counts.set(card.setId, (counts.get(card.setId) ?? 0) + 1);
  for (const set of backup.sets) requireValid((counts.get(set.id) ?? 0) >= 1 && counts.get(set.id)! <= 5000, 'sets must have 1–5,000 cards.');
  for (const p of backup.progress) requireValid(cards.has(p.cardId), 'progress refers to a missing card.');
  for (const s of backup.sessions) {
    requireValid(sets.has(s.setId) && s.correctAnswers <= s.totalQuestions, 'session totals or set are inconsistent.');
    if (!s.run) continue;
    const r = s.run, questionIds = new Set(r.questions.map(q => q.cardId));
    requireValid(r.questions.length > 0 && questionIds.size === r.questions.length && r.index <= r.questions.length && r.queue.every(i => i < r.questions.length), 'session question indexes are inconsistent.');
    requireValid(s.mode !== 'flashcards' || r.index < r.questions.length, 'flashcard position is out of range.');
    requireValid(s.finishedAt !== undefined || s.mode !== 'test' || r.index < r.questions.length, 'unfinished test has no current question.');
    requireValid(s.finishedAt !== undefined || s.mode !== 'learn' || r.queue.length || r.feedback, 'unfinished Learn session has no question or feedback.');
    requireValid(r.questions.every(q => !cards.has(q.cardId) || cards.get(q.cardId)?.setId === s.setId), 'session card belongs to another set.');
    requireValid(r.answers.every(a => questionIds.has(a.cardId)) && r.visited.every(c => questionIds.has(c)) && (!r.feedback || questionIds.has(r.feedback.cardId)) && (r.ratings ?? []).every(a => questionIds.has(a.cardId)), 'session refers to an unknown question.');
    requireValid(new Set((r.ratings ?? []).map(a => a.cardId)).size === (r.ratings ?? []).length, 'duplicate session ratings.');
    requireValid(r.questions.every(q => q.accepted.length > 0), 'question has no accepted answer.');
    if (s.mode !== 'flashcards') requireValid(s.totalQuestions === r.answers.length && s.correctAnswers === r.answers.filter(a => a.correct).length, 'session answer totals are inconsistent.');
  }
  for (const r of backup.reviews) requireValid(cards.get(r.cardId)?.setId === r.setId && sessions.get(r.sessionId)?.setId === r.setId && sessions.get(r.sessionId)?.mode === r.source && r.id === `${r.sessionId}:${r.cardId}`, 'review references are inconsistent.');
  for (const setting of backup.settings) {
    if (setting.key === 'theme') requireValid(one('system', 'light', 'dark')(setting.value), 'unknown theme.');
    if (setting.key === 'study-options') { let parsed: unknown; try { parsed = JSON.parse(setting.value); } catch { throw new Error('Invalid backup: study options are malformed.'); } requireValid(options(parsed), 'study options are malformed.'); }
  }
  return backup;
}
export async function exportBackup(database = db): Promise<Backup> {
  return database.transaction('r', database.tables, async () => ({ format: 'recall-library', version: 1, exportedAt: Date.now(), folders: await database.folders.toArray(), sets: await database.sets.toArray(), cards: await database.cards.toArray(), progress: await database.progress.toArray(), sessions: await database.sessions.toArray(), settings: await database.settings.toArray(), reviews: await database.reviews.toArray() }));
}
export async function restoreBackup(input: Backup, mode: 'merge' | 'replace', database = db) {
  // Validate again at the write boundary; fresh IDs isolate existing tabs and preserve all snapshot references.
  const b = parseBackup(JSON.stringify(input));
  const remap = (ids: string[]) => new Map(ids.map(id => [id, crypto.randomUUID()]));
  const folders = remap(b.folders.map(f => f.id)), sets = remap(b.sets.map(s => s.id)), sessions = remap(b.sessions.map(s => s.id));
  const cards = remap([...new Set([...b.cards.map(c => c.id), ...b.sessions.flatMap(s => s.run?.questions.map(q => q.cardId) ?? [])])]);
  b.folders = b.folders.map(f => ({ ...f, id: folders.get(f.id)!, parentId: f.parentId ? folders.get(f.parentId) : undefined }));
  b.sets = b.sets.map(s => ({ ...s, id: sets.get(s.id)!, folderId: s.folderId ? folders.get(s.folderId) : undefined }));
  b.cards = b.cards.map(c => ({ ...c, id: cards.get(c.id)!, setId: sets.get(c.setId)! }));
  b.progress = b.progress.map(p => ({ ...p, cardId: cards.get(p.cardId)! }));
  b.reviews = b.reviews.map(r => ({ ...r, id: `${sessions.get(r.sessionId)}:${cards.get(r.cardId)}`, cardId: cards.get(r.cardId)!, setId: sets.get(r.setId)!, sessionId: sessions.get(r.sessionId)! }));
  b.sessions = b.sessions.map(s => ({ ...s, id: sessions.get(s.id)!, setId: sets.get(s.setId)!, run: s.run ? { ...s.run, questions: s.run.questions.map(q => ({ ...q, cardId: cards.get(q.cardId)! })), answers: s.run.answers.map(a => ({ ...a, cardId: cards.get(a.cardId)! })), visited: s.run.visited.map(c => cards.get(c)!), feedback: s.run.feedback ? { ...s.run.feedback, cardId: cards.get(s.run.feedback.cardId)! } : undefined, ratings: s.run.ratings?.map(r => ({ ...r, cardId: cards.get(r.cardId)! })) } : undefined }));
  await database.transaction('rw', database.tables, async () => {
    if (mode === 'replace') for (const table of database.tables) await table.clear();
    await database.folders.bulkAdd(b.folders); await database.sets.bulkAdd(b.sets); await database.cards.bulkAdd(b.cards);
    await database.progress.bulkAdd(b.progress); await database.sessions.bulkAdd(b.sessions); await database.reviews.bulkAdd(b.reviews);
    if (mode === 'replace') await database.settings.bulkAdd(b.settings);
  });
}
