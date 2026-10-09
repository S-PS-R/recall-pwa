import { describe, expect, it } from 'vitest';
import { DAY, dueCards, scheduleReview, summarizeProgress } from './scheduler';
import type { Flashcard } from './types';
describe('deterministic review scheduler', () => {
  it('schedules Again in ten minutes, Hard in one day and Easy in four', () => {
    expect(scheduleReview('card', undefined, 'again', 100).dueAt).toBe(600100);
    expect(scheduleReview('card', undefined, 'hard', 100).dueAt).toBe(DAY + 100);
    expect(scheduleReview('card', undefined, 'easy', 100).dueAt).toBe(4 * DAY + 100);
  });
  it('requires spaced successes for mastery and does not mutate previous state', () => {
    const first = scheduleReview('card', undefined, 'good', 0);
    const early = scheduleReview('card', first, 'easy', DAY - 1);
    expect(early.repetitions).toBe(1); expect(early.dueAt).toBe(DAY);
    expect(first.correctCount).toBe(1);
    const second = scheduleReview('card', first, 'good', DAY);
    const third = scheduleReview('card', second, 'good', second.dueAt!);
    expect(third.state).toBe('mastered'); expect(third.intervalDays).toBe(8);
    expect(scheduleReview('card', third, 'again', third.dueAt!).state).toBe('learning');
    expect(scheduleReview('card', third, 'hard', third.lastReviewedAt! + 1).state).toBe('learning');
  });
  it('caps intervals and keeps counters', () => {
    let state = scheduleReview('card', undefined, 'easy', 0);
    for (let i = 0; i < 15; i++) state = scheduleReview('card', state, 'easy', state.dueAt!);
    expect(state.intervalDays).toBe(365); expect(state.correctCount).toBe(16);
    state = scheduleReview('card', state, 'again', state.dueAt!);
    expect(state.repetitions).toBe(0); expect(state.incorrectCount).toBe(1); expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
  it('excludes new/orphan/future cards from due queue and handles empty libraries', () => {
    const cards = ['a', 'b', 'c'].map((id, position) => ({ id, position } as Flashcard));
    const progress = [scheduleReview('a', undefined, 'good', 0), scheduleReview('b', undefined, 'again', 0), scheduleReview('orphan', undefined, 'again', 0)];
    expect(dueCards(cards, progress, DAY).map(card => card.id)).toEqual(['b', 'a']);
    expect(summarizeProgress(cards, progress, 600000)).toMatchObject({ fresh: 1, due: 1, mastered: 0, total: 3 });
    expect(summarizeProgress([], progress, DAY).percent).toBe(0);
  });
});
