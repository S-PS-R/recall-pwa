import { db, type RecallDatabase } from './database';
import type { ActiveSession } from '../domain/study';
import { cardKey } from '../domain/types';
import { scheduleReview, type Rating } from '../domain/scheduler';

export async function saveSession(session: ActiveSession, database: RecallDatabase = db, now = Date.now()): Promise<ActiveSession> {
  return database.transaction('rw', [database.sets, database.sessions, database.settings, database.cards, database.progress, database.reviews], async () => {
    if (!await database.sets.get(session.setId)) throw new Error('This set was deleted. Return to your library.');
    const previous = await database.sessions.get(session.id);
    if ((previous?.revision ?? 0) !== (session.revision ?? 0)) throw new Error('This session changed in another tab. Pause and resume the latest saved session.');
    const candidates: { cardId: string; rating: Rating }[] = session.mode === 'flashcards'
      ? (session.run.ratings ?? []).slice(previous?.run?.ratings?.length ?? 0)
      : session.run.answers.slice(previous?.run?.answers.length ?? 0).filter((answer, index) => !session.run.answers.slice(0, (previous?.run?.answers.length ?? 0) + index).some(old => old.cardId === answer.cardId)).map(answer => ({ cardId: answer.cardId, rating: answer.correct ? 'good' : 'again' }));
    for (const candidate of candidates) {
      const id = `${session.id}:${candidate.cardId}`;
      if (await database.reviews.get(id)) continue;
      const card = await database.cards.get(candidate.cardId);
      const question = session.run.questions.find(item => item.cardId === candidate.cardId);
      if (!card || card.setId !== session.setId || !question) continue;
      const snapshotKey = question.sourceKey ?? cardKey(session.run.options.direction === 'forward' ? { front: question.prompt, back: question.answer } : { front: question.answer, back: question.prompt });
      // Old snapshots remain usable, but must never recreate progress for edited cards.
      if (snapshotKey !== card.normalizedKey) continue;
      const progress = await database.progress.get(card.id);
      await database.progress.put(scheduleReview(card.id, progress, candidate.rating, now));
      await database.reviews.add({ id, cardId: card.id, setId: card.setId, sessionId: session.id, reviewedAt: now, rating: candidate.rating, source: session.mode });
    }
    const saved = { ...session, revision: (previous?.revision ?? 0) + 1 };
    await database.sessions.put(saved);
    await database.settings.put({ key: 'study-options', value: JSON.stringify(session.run.options) });
    return saved;
  });
}
