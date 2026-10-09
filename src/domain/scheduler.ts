import type { CardProgress, Flashcard } from './types';
export type Rating = 'again' | 'hard' | 'good' | 'easy';
export const DAY = 86_400_000;
export interface ReviewEvent { id: string; cardId: string; setId: string; sessionId: string; reviewedAt: number; rating: Rating; source: 'flashcards' | 'learn' | 'test' }
export function scheduleReview(cardId: string, previous: CardProgress | undefined, rating: Rating, now: number): CardProgress {
  const old = previous ?? { cardId, repetitions: 0, intervalDays: 0, easeFactor: 2.5, state: 'new' as const, correctCount: 0, incorrectCount: 0 };
  const base = { ...old, lastReviewedAt: now, correctCount: old.correctCount + (rating === 'again' ? 0 : 1), incorrectCount: old.incorrectCount + (rating === 'again' ? 1 : 0) };
  if (rating === 'again') return { ...base, repetitions: 0, intervalDays: 10 / 1440, dueAt: now + 600_000, easeFactor: Math.max(1.3, (old.easeFactor ?? 2.5) - .2), state: 'learning' };
  // Extra practice before the due time never inflates mastery or pushes the due date away.
  if (old.dueAt !== undefined && old.dueAt > now) return rating === 'hard' ? { ...base, repetitions: 0, state: 'learning' } : base;
  const ease = Math.min(3, Math.max(1.3, (old.easeFactor ?? 2.5) + (rating === 'easy' ? .15 : rating === 'hard' ? -.15 : 0)));
  const intervalDays = Math.min(365, rating === 'hard' ? Math.max(1, Math.ceil(old.intervalDays * 1.2)) : rating === 'easy' ? Math.max(4, Math.ceil(old.intervalDays * (ease + .5))) : old.intervalDays < 1 ? 1 : Math.max(3, Math.ceil(old.intervalDays * ease)));
  const repetitions = rating === 'hard' ? 0 : old.repetitions + 1;
  return { ...base, repetitions, intervalDays, easeFactor: ease, dueAt: now + intervalDays * DAY, state: repetitions >= 3 && intervalDays >= 7 ? 'mastered' : rating === 'hard' || repetitions < 2 ? 'learning' : 'review' };
}
export function summarizeProgress(cards: Flashcard[], progress: CardProgress[], now: number) {
  const byId = new Map(progress.map(item => [item.cardId, item]));
  let fresh = 0, learning = 0, review = 0, mastered = 0, due = 0;
  for (const card of cards) {
    const item = byId.get(card.id);
    if (!item || item.state === 'new') fresh++;
    else if (item.state === 'mastered') mastered++;
    else if (item.state === 'review') review++;
    else learning++;
    if (item?.dueAt !== undefined && item.dueAt <= now) due++;
  }
  return { total: cards.length, fresh, learning, review, mastered, due, percent: cards.length ? Math.round(mastered / cards.length * 100) : 0 };
}
export function dueCards(cards: Flashcard[], progress: CardProgress[], now: number) {
  const byId = new Map(progress.map(item => [item.cardId, item]));
  return cards.filter(card => (byId.get(card.id)?.dueAt ?? Infinity) <= now).sort((a, b) => byId.get(a.id)!.dueAt! - byId.get(b.id)!.dueAt! || a.position - b.position);
}
