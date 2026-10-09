import { summarizeProgress } from '../../domain/scheduler';
import type { CardProgress, Flashcard } from '../../domain/types';
export function SetProgress({ cards, progress, now }: { cards: Flashcard[]; progress: CardProgress[]; now: number }) {
  const stats = summarizeProgress(cards, progress, now);
  const ids = new Set(cards.map(card => card.id));
  const lastStudied = progress.reduce((latest, item) => ids.has(item.cardId) ? Math.max(latest, item.lastReviewedAt ?? 0) : latest, 0);
  return <div className="set-progress"><span>{stats.mastered} / {stats.total} mastered · {stats.due} due</span><progress className="mastery-bar" aria-label="Set mastery" max={Math.max(1, stats.total)} value={stats.mastered} /><span className="muted">{lastStudied ? `Last reviewed ${new Date(lastStudied).toLocaleDateString()}` : 'Not reviewed yet'}</span></div>;
}
