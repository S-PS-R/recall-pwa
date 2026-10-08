import { db, type RecallDatabase } from './database';
import type { ActiveSession } from '../domain/study';

export async function saveSession(session: ActiveSession, database: RecallDatabase = db) {
  await database.transaction('rw', database.sets, database.sessions, database.settings, async () => {
    if (!await database.sets.get(session.setId)) throw new Error('This set was deleted. Return to your library.');
    await database.sessions.put(session);
    await database.settings.put({ key: 'study-options', value: JSON.stringify(session.run.options) });
  });
}
