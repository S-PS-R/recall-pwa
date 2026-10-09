import { useState } from 'react';
import { firstAttemptScore, type ActiveSession } from '../../domain/study';
import { summarizeProgress, type ReviewEvent } from '../../domain/scheduler';
import type { CardProgress, Flashcard, StudySession, StudySet } from '../../domain/types';

export function Progress({ cards, progress, sets, sessions, reviews, now }: { cards: Flashcard[]; progress: CardProgress[]; sets: StudySet[]; sessions: StudySession[]; reviews: ReviewEvent[]; now: number }) {
  const [filter, setFilter] = useState('');
  const summary = summarizeProgress(cards.filter(card => !filter || card.setId === filter), progress, now);
  const scored = sessions.filter(s => (!filter || s.setId === filter) && s.mode !== 'flashcards' && s.run).map(s => firstAttemptScore(s as ActiveSession));
  const total = scored.reduce((n, score) => n + score.total, 0), correct = scored.reduce((n, score) => n + score.correct, 0);
  const activity = reviews.filter(event => !filter || event.setId === filter).slice(0, 20);
  return <>
    <div className="page-heading"><div><span className="eyebrow">SMALL STEPS, LASTING KNOWLEDGE</span><h1>Your progress</h1><p className="muted">See what’s sticking and what needs another look.</p></div></div>
    <label className="progress-filter">Study set<select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filter progress by set"><option value="">All study sets</option>{sets.map(set => <option key={set.id} value={set.id}>{set.title}</option>)}</select></label>
    <div className="metric-grid"><div><strong>{summary.due}</strong><span>Due now</span></div><div><strong>{summary.fresh}</strong><span>New cards</span></div><div><strong>{summary.learning + summary.review}</strong><span>Still learning</span></div><div><strong>{summary.mastered}</strong><span>Mastered</span></div></div>
    <section className="settings-panel"><div className="row-between"><h2>Long-term mastery</h2><strong>{summary.percent}%</strong></div><progress className="mastery-bar" aria-label="Library mastery" max={Math.max(1, summary.total)} value={summary.mastered} /><p>{summary.mastered} of {summary.total} cards mastered. Mastery requires at least three successful scheduled reviews and a review interval of seven days or more.</p><p className="muted">Viewing a card doesn’t count as knowing it. Extra practice before a card is due won’t inflate mastery. Again or Hard returns a card to learning.</p></section>
    <section className="settings-panel"><h2>Session accuracy</h2><p className="accuracy-value">{total ? `${Math.round(correct / total * 100)}%` : 'No answers yet'}</p><p className="muted">{correct} correct out of {total} first attempts in Learn and Test, including saved sessions. Retries and self-rated flashcards are excluded. This is separate from mastery.</p></section>
    <section><div className="section-heading"><h2>Review due cards</h2></div>{!summary.due && <p className="notice">You’re caught up on scheduled reviews. Practice a set to start learning new cards.</p>}<div className="set-grid">{sets.filter(set => !filter || set.id === filter).map(set => {
      const stats = summarizeProgress(cards.filter(card => card.setId === set.id), progress, now);
      return stats.due ? <a href={`#study/${set.id}/review`} key={set.id} className="set-tile"><h3>{set.title}</h3><p className="muted">{stats.due} due now</p><span className="text-button">Review now →</span></a> : null;
    })}</div></section>
    <section className="settings-panel mt-6"><h2>Recent reviews</h2>{!activity.length && <p className="muted">Rate a flashcard or answer a new Learn/Test question to record a review. Earlier sessions are kept, but are not retroactively scheduled.</p>}{activity.map(event => <div className="activity-row" key={event.id}><div><strong>{cards.find(card => card.id === event.cardId)?.front ?? 'Removed card'}</strong><p className="muted text-sm">{sets.find(set => set.id === event.setId)?.title} · {event.source}</p></div><div><span className={`rating-label rating-${event.rating}`}>{event.rating}</span><p className="muted text-xs">{new Date(event.reviewedAt).toLocaleString()}</p></div></div>)}</section>
    {!cards.length && <a className="button primary" href="#library">Create or import your first set</a>}
  </>;
}
