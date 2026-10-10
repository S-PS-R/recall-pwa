import { afterEach, beforeEach, expect, it } from 'vitest';
import { createSets, RecallDatabase, updateSet } from './database';
import { cardSnapshot, importSets } from './imports';
import { deleteFolder, moveSet, saveFolder } from './folders';
import { exportBackup, parseBackup, restoreBackup } from '../features/backup/backup';
import { continueLearn, createSession, submitAnswer, type ActiveSession } from '../domain/study';
import { saveSession } from './study';
import { setText } from '../utils/files';
import { parseTsv } from '../features/import/parser';
let db: RecallDatabase;
beforeEach(() => { db = new RecallDatabase(`m4-${crypto.randomUUID()}`); });
afterEach(async () => { await db.delete(); });
async function seed() {
  const [id] = await createSets([{ title: 'Hindi', cards: [{ front: 'नमस्ते', back: 'Hello!' }, { front: 'लड़का', back: 'Boy' }] }], db);
  const cards = await db.cards.toCollection().sortBy('position');
  const session = await saveSession(submitAnswer(createSession('session', id, 'learn', cards, { count: 2, direction: 'forward', comparison: 'strict', questionMode: 'written' }, 10, () => .99), 'HELLO', 20), db, 20);
  await saveFolder('Languages', undefined, db); const folder = (await db.folders.toArray())[0]; await moveSet(id, folder.id, db);
  await db.settings.put({ key: 'theme', value: 'dark' });
  return { id, cards, session };
}
it('merge and replace retain unchanged IDs, schedules and history; changed pairs get fresh IDs', async () => {
  const { id, cards } = await seed(); const progress = await db.progress.toArray();
  await importSets([{ mode: 'merge', targetId: id, expectedCards: cardSnapshot(cards), draft: { title: 'Hindi', cards: [{ front: 'नमस्ते', back: 'Hello!' }, { front: 'नया', back: 'New' }] } }], db);
  expect(await db.cards.count()).toBe(3); expect(await db.progress.toArray()).toEqual(progress);
  const merged = await db.cards.toArray();
  await importSets([{ mode: 'replace', targetId: id, expectedCards: cardSnapshot(merged), draft: { title: 'Updated', cards: [{ front: 'नया', back: 'New' }, { front: 'नमस्ते', back: 'Hello!' }] } }], db);
  expect(await db.cards.get(cards[0].id)).toMatchObject({ position: 1 }); expect(await db.cards.get(cards[1].id)).toBeUndefined();
  expect(await db.progress.toArray()).toEqual(progress); expect(await db.reviews.count()).toBe(1); expect(await db.sessions.count()).toBe(1);
  const next = await db.cards.toArray();
  await importSets([{ mode: 'replace', targetId: id, expectedCards: cardSnapshot(next), draft: { title: 'Changed', cards: [{ front: 'नमस्ते', back: 'Greetings' }] } }], db);
  expect(await db.progress.count()).toBe(0); expect(await db.reviews.count()).toBe(0); expect(await db.sessions.count()).toBe(1);
  expect((await db.cards.toArray())[0].id).not.toBe(cards[0].id);
});
it('rejects stale previews and rolls back an entire batch', async () => {
  const { id, cards } = await seed(); const before = await exportBackup(db);
  await expect(importSets([{ mode: 'new', draft: { title: 'Should roll back', cards: [{ front: 'a', back: 'b' }] } }, { mode: 'replace', targetId: id, expectedCards: 'stale', draft: { title: 'Bad', cards } }], db)).rejects.toThrow('changed');
  expect({ ...await exportBackup(db), exportedAt: 0 }).toEqual({ ...before, exportedAt: 0 });
});
it('round-trips every table, resumes Learn without replaying reviews, and isolates stale tabs', async () => {
  const { session } = await seed(); const before = parseBackup(JSON.stringify(await exportBackup(db)));
  await restoreBackup(before, 'replace', db);
  expect(await db.sets.count()).toBe(1); expect(await db.folders.count()).toBe(1); expect(await db.progress.count()).toBe(1);
  expect((await db.progress.toArray())[0]).toMatchObject({ dueAt: before.progress[0].dueAt, repetitions: before.progress[0].repetitions, correctCount: 1 });
  expect((await db.settings.get('theme'))?.value).toBe('dark');
  await expect(saveSession(session, db)).rejects.toThrow('deleted');
  const resumed = (await db.sessions.toArray())[0] as ActiveSession;
  expect(resumed.run.feedback?.correct).toBe(true);
  await saveSession(continueLearn(resumed, 30), db, 30);
  expect(await db.reviews.count()).toBe(1); expect((await db.progress.toArray())[0].correctCount).toBe(1);
  expect(() => parseBackup(JSON.stringify(before))).not.toThrow();
});
it('merge adds isolated copies and keeps the current preferences and progress', async () => {
  await seed(); const backup = await exportBackup(db); await db.settings.put({ key: 'theme', value: 'light' });
  await restoreBackup(backup, 'merge', db);
  expect(await db.sets.count()).toBe(2); expect(await db.folders.count()).toBe(2); expect(await db.progress.count()).toBe(2); expect(await db.reviews.count()).toBe(2);
  expect((await db.settings.get('theme'))?.value).toBe('light');
  expect(() => parseBackup(JSON.stringify(backup))).not.toThrow();
});
it('rejects malformed versions, orphan progress, invalid snapshots and duplicate IDs before modifying data', async () => {
  await seed(); const backup = await exportBackup(db);
  const variants = [ { ...backup, version: 99 }, { ...backup, cards: [backup.cards[0], backup.cards[0]] }, { ...backup, progress: [{ ...backup.progress[0], cardId: 'missing' }] }, { ...backup, sessions: [{ ...backup.sessions[0], run: { ...backup.sessions[0].run, queue: [99] } }] }, { ...backup, sessions: [{ ...backup.sessions[0], run: { ...backup.sessions[0].run, options: {} } }] } ];
  for (const value of variants) { expect(() => parseBackup(JSON.stringify(value))).toThrow('Invalid backup'); await expect(restoreBackup(value as typeof backup, 'replace', db)).rejects.toThrow(); }
  expect({ ...await exportBackup(db), exportedAt: 0 }).toEqual({ ...backup, exportedAt: 0 });
  expect(() => parseBackup('{')).toThrow('valid JSON');
});
it('rolls back a replace restore if a write fails after clearing tables', async () => {
  await seed(); const backup = await exportBackup(db);
  const fail = () => { throw new Error('Storage full'); }; db.cards.hook('creating', fail);
  try { await expect(restoreBackup(backup, 'replace', db)).rejects.toThrow('Storage full'); } finally { db.cards.hook('creating').unsubscribe(fail); }
  expect({ ...await exportBackup(db), exportedAt: 0 }).toEqual({ ...backup, exportedAt: 0 });
});
it('preserves deleted-card historical snapshots and does not recreate their progress after restore', async () => {
  const { id, cards } = await seed(); await updateSet(id, { title: 'Hindi', cards }, [cards[1]], db);
  await restoreBackup(await exportBackup(db), 'replace', db);
  const session = (await db.sessions.toArray())[0] as ActiveSession;
  await saveSession(continueLearn(session, 30), db, 30); expect(await db.progress.count()).toBe(0);
});
it('folder rename, move and deletion keep all cards and progress', async () => {
  const { id } = await seed(); const folder = (await db.folders.toArray())[0]; await saveFolder('Renamed', folder.id, db);
  expect((await db.folders.get(folder.id))?.name).toBe('Renamed'); await deleteFolder(folder.id, db);
  expect((await db.sets.get(id))?.folderId).toBeUndefined(); expect(await db.cards.count()).toBe(2); expect(await db.progress.count()).toBe(1);
  await expect(moveSet(id, 'missing', db)).rejects.toThrow();
});
it('exports literal Hindi pairs with extra definition tabs and rejects unrepresentable multiline cards', () => {
  const cards = [{ front: 'नमस्ते', back: 'Hello\textra' }, { front: 'लड़का', back: 'Boy' }];
  expect(parseTsv(setText(cards)).cards).toEqual(cards);
  expect(() => setText([{ front: 'a\nb', back: 'c' }])).toThrow('backup');
});
