import { afterEach, beforeEach, expect, it } from 'vitest';
import Dexie from 'dexie';
import { createSets, deleteSet, RecallDatabase, updateSet } from './database';
import { saveSession } from './study';
import { continueLearn, createSession, submitAnswer } from '../domain/study';
let db: RecallDatabase;
beforeEach(() => { db = new RecallDatabase(`study-${crypto.randomUUID()}`); });
afterEach(async () => { await db.delete(); });
it('persists a session snapshot and schedules exactly once across saves and reopening', async () => {
  const [id] = await createSets([{ title: 'Test', cards: [{ front: 'नमस्ते', back: 'Hello' }] }], db);
  const cards = await db.cards.toArray();
  const session = submitAnswer(createSession('session', id, 'learn', cards, { count: 1, direction: 'forward', comparison: 'lenient', questionMode: 'written' }, 1), 'Hello', 2);
  const saved = await saveSession(await saveSession(session, db, 2), db, 3);
  db.close(); await db.open();
  expect(await db.sessions.get('session')).toEqual(saved); expect(await db.sessions.count()).toBe(1);
  expect(await db.progress.count()).toBe(1); expect(await db.reviews.count()).toBe(1);
  expect((await db.settings.get('study-options'))?.value).toContain('lenient');
  await deleteSet(id, db); expect(await db.sessions.count()).toBe(0);
  expect(await db.reviews.count()).toBe(0);
  await expect(saveSession(session, db)).rejects.toThrow('deleted');
  expect(await db.sessions.count()).toBe(0);
});
it('records only the first Learn attempt, rejects stale saves, and does not inflate progress on retry', async () => {
  const [id] = await createSets([{ title: 'Quiz', cards: [{ front: 'नमस्ते', back: 'Hello' }] }], db);
  let session = await saveSession(createSession('learn', id, 'learn', await db.cards.toArray(), { count: 1, direction: 'forward', comparison: 'strict', questionMode: 'written' }, 0), db, 0);
  const stale = session;
  session = await saveSession(submitAnswer(session, 'wrong', 1), db, 1);
  await expect(saveSession(stale, db, 2)).rejects.toThrow('another tab');
  session = await saveSession(continueLearn(session, 2), db, 2);
  session = await saveSession(submitAnswer(session, 'HELLO!', 3), db, 3);
  expect(session.correctAnswers).toBe(1);
  expect(await db.reviews.count()).toBe(1);
  expect((await db.progress.toArray())[0]).toMatchObject({ incorrectCount: 1, correctCount: 0, state: 'learning', dueAt: 600001 });
});
it('rolls back session and schedule together when review storage fails', async () => {
  const [id] = await createSets([{ title: 'Quiz', cards: [{ front: 'a', back: 'b' }] }], db);
  const session = await saveSession(createSession('rollback', id, 'test', await db.cards.toArray(), { count: 1, direction: 'forward', comparison: 'strict', questionMode: 'written' }, 0), db, 0);
  function fail() { throw new Error('Storage full'); }
  db.reviews.hook('creating', fail);
  try { await expect(saveSession(submitAnswer(session, 'b', 1), db, 1)).rejects.toThrow('Storage full'); }
  finally { db.reviews.hook('creating').unsubscribe(fail); }
  expect(await db.progress.count()).toBe(0); expect(await db.sessions.get(session.id)).toEqual(session);
});
it('does not recreate progress from a stale snapshot after card editing', async () => {
  const draft = { title: 'Quiz', cards: [{ front: 'a', back: 'b' }] };
  const [id] = await createSets([draft], db);
  const cards = await db.cards.toArray();
  const session = await saveSession(createSession('snapshot', id, 'test', cards, { count: 1, direction: 'forward', comparison: 'strict', questionMode: 'written' }, 0), db, 0);
  await updateSet(id, draft, [{ ...cards[0], back: 'changed' }], db);
  await saveSession(submitAnswer(session, 'b', 1), db, 1);
  expect(await db.progress.count()).toBe(0); expect(await db.reviews.count()).toBe(0);
});
it('removes a changed card’s schedule and review events while preserving its session history', async () => {
  const draft = { title: 'Quiz', cards: [{ front: 'a', back: 'b' }] };
  const [id] = await createSets([draft], db);
  const cards = await db.cards.toArray();
  await saveSession(submitAnswer(createSession('edit', id, 'test', cards, { count: 1, direction: 'forward', comparison: 'strict', questionMode: 'written' }, 0), 'b', 1), db, 1);
  expect(await db.reviews.count()).toBe(1);
  await updateSet(id, draft, [{ ...cards[0], back: 'changed' }], db);
  expect(await db.progress.count()).toBe(0); expect(await db.reviews.count()).toBe(0); expect(await db.sessions.count()).toBe(1);
});
it('upgrades v2 without losing cards, historical sessions, or existing progress and never replays old answers', async () => {
  const old = new Dexie(db.name);
  old.version(2).stores({ folders: 'id, parentId', sets: 'id, folderId, updatedAt', cards: 'id, setId, [setId+position], normalizedKey', progress: 'cardId, dueAt, state', sessions: 'id, setId, startedAt', settings: 'key' });
  await old.table('sets').put({ id: 'legacy-set', title: 'Legacy', createdAt: 0, updatedAt: 0 });
  const card = { id: 'legacy-card', setId: 'legacy-set', front: 'a', back: 'b', position: 0, normalizedKey: '["a","b"]', createdAt: 0, updatedAt: 0 };
  await old.table('cards').put(card);
  const historic = submitAnswer(createSession('historic', card.setId, 'learn', [card], { count: 1, direction: 'forward', comparison: 'strict', questionMode: 'written' }, 0), 'b', 1);
  await old.table('sessions').put(historic);
  await old.table('progress').put({ cardId: card.id, state: 'review', dueAt: 100, repetitions: 2, intervalDays: 3, correctCount: 2, incorrectCount: 0 }); old.close();
  await db.open(); expect(await db.cards.get(card.id)).toEqual(card);
  expect((await db.progress.get(card.id))?.repetitions).toBe(2);
  await saveSession(continueLearn(historic, 2), db, 2);
  expect(await db.reviews.count()).toBe(0); expect((await db.progress.get(card.id))?.correctCount).toBe(2);
});
