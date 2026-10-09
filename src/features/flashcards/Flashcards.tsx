import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Shuffle } from 'lucide-react';
import { shuffle, type ActiveSession } from '../../domain/study';
import { scheduleReview, type Rating } from '../../domain/scheduler';
import type { CardProgress } from '../../domain/types';

export function Flashcards({ session, busy, onChange, progress, now }: { session: ActiveSession; busy: boolean; onChange: (next: ActiveSession) => void; progress: CardProgress[]; now: number }) {
  const { run } = session;
  const card = run.questions[run.index];
  const rating = run.ratings?.find(item => item.cardId === card.cardId);
  const previous = progress.find(item => item.cardId === card.cardId);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const flip = () => onChange({ ...session, run: { ...run, flipped: !run.flipped, visited: [...new Set([...run.visited, card.cardId])] } });
  const move = (offset: number) => { const index = run.index + offset; if (index >= 0 && index < run.questions.length) onChange({ ...session, run: { ...run, index, flipped: false } }); };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (busy || target.closest('input, textarea, select, button, a, dialog')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
      if (event.code === 'Space') { event.preventDefault(); flip(); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  });
  return <div className="study-workspace">
    <div className="row-between"><span className="eyebrow">CARD {run.index + 1} OF {run.questions.length}</span><span className="muted text-sm">{run.visited.length} revealed</span></div>
    <progress aria-label="Cards revealed" value={run.visited.length} max={run.questions.length} />
    <button className={`flip-card ${run.flipped ? 'is-flipped' : ''}`} disabled={busy} aria-label={run.flipped ? 'Show prompt' : 'Show answer'} onClick={() => { if (!swiped.current) flip(); swiped.current = false; }}
      onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; swiped.current = false; }}
      onTouchEnd={event => { if (!touch.current || busy) return; const dx = event.changedTouches[0].clientX - touch.current.x, dy = event.changedTouches[0].clientY - touch.current.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { swiped.current = true; move(dx < 0 ? 1 : -1); } touch.current = null; }}>
      <span className="eyebrow">{run.flipped ? 'ANSWER' : 'PROMPT'}</span><span className="flashcard-text" key={`${card.cardId}-${run.flipped}`}>{run.flipped ? card.answer : card.prompt}</span><span className="flip-hint">Tap to {run.flipped ? 'see prompt' : 'reveal answer'}</span>
    </button>
    {run.flipped && !rating && <section className="rating-panel"><h2>How well did you remember?</h2><div className="rating-buttons">{(['again', 'hard', 'good', 'easy'] as Rating[]).map(value => {
      const next = scheduleReview(card.cardId, previous, value, now);
      const minutes = Math.max(1, Math.round((next.dueAt! - now) / 60000));
      return <button key={value} className={`button rating-${value}`} disabled={busy} aria-label={`Rate ${value}`} onClick={() => onChange({ ...session, run: { ...run, ratings: [...(run.ratings ?? []), { cardId: card.cardId, rating: value }] } })}><strong>{value}</strong><span>{minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.ceil(minutes / 60)} hr` : `${Math.ceil(minutes / 1440)} days`}</span></button>;
    })}</div></section>}
    {rating && <p role="status" className="notice">Rated {rating.rating}. {previous?.dueAt ? `Next review: ${new Date(previous.dueAt).toLocaleString()}.` : 'The card changed since this session started; start a new session to schedule it.'}</p>}
    <div className="flashcard-controls"><button className="button secondary" disabled={busy || run.index === 0} onClick={() => move(-1)}><ArrowLeft size={18} />Previous</button><button className="button secondary" disabled={busy} onClick={flip}><RotateCcw size={18} />Flip</button><button className="button secondary" disabled={busy || run.index === run.questions.length - 1} onClick={() => move(1)}>Next<ArrowRight size={18} /></button></div>
    <div className="study-actions"><button className="button secondary" disabled={busy || run.questions.length < 2} onClick={() => onChange({ ...session, run: { ...run, questions: shuffle(run.questions), index: 0, flipped: false } })}><Shuffle size={17} />Shuffle</button><button className="button secondary" disabled={busy} onClick={() => onChange({ ...session, run: { ...run, options: { ...run.options, direction: run.options.direction === 'forward' ? 'reverse' : 'forward' }, questions: run.questions.map(question => ({ ...question, prompt: question.answer, answer: question.prompt })), flipped: false } })}>Reverse direction</button><button className="button primary" disabled={busy} onClick={() => onChange({ ...session, finishedAt: Date.now() })}>Finish session</button></div>
    <p className="milestone-note">Reveal the answer to rate your recall. One rating per card per session. Swipe left/right to move. On desktop: Space flips and arrow keys move when no control is focused.</p>
  </div>;
}
