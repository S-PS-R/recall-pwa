import { afterEach, expect, it } from 'vitest';
import { createSets, deleteSet, RecallDatabase } from './database';
import { saveSession } from './study';
import { createSession, submitAnswer } from '../domain/study';
const db = new RecallDatabase('study-session-tests');
afterEach(async () => { await db.delete(); });
it('persists a session snapshot and resumes answers after reopening without changing card progress', async () => {
  const [id] = await createSets([{ title: 'Test', cards: [{ front: 'नमस्ते', back: 'Hello' }] }], db);
  const cards = await db.cards.toArray();
  const session = submitAnswer(createSession('session', id, 'learn', cards, { count: 1, direction: 'forward', comparison: 'lenient', questionMode: 'written' }, 1), 'Hello', 2);
  await saveSession(session, db); await saveSession(session, db);
  db.close(); await db.open();
  expect(await db.sessions.get('session')).toEqual(session); expect(await db.sessions.count()).toBe(1);
  expect(await db.progress.count()).toBe(0);
  expect((await db.settings.get('study-options'))?.value).toContain('lenient');
  await deleteSet(id, db); expect(await db.sessions.count()).toBe(0);
  await expect(saveSession(session, db)).rejects.toThrow('deleted');
  expect(await db.sessions.count()).toBe(0);
});
