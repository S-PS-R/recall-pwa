import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Shuffle } from 'lucide-react';
import { shuffle, type ActiveSession } from '../../domain/study';

export function Flashcards({ session, busy, onChange }: { session: ActiveSession; busy: boolean; onChange: (next: ActiveSession) => void }) {
  const { run } = session;
  const card = run.questions[run.index];
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
    <div className="flashcard-controls"><button className="button secondary" disabled={busy || run.index === 0} onClick={() => move(-1)}><ArrowLeft size={18} />Previous</button><button className="button secondary" disabled={busy} onClick={flip}><RotateCcw size={18} />Flip</button><button className="button secondary" disabled={busy || run.index === run.questions.length - 1} onClick={() => move(1)}>Next<ArrowRight size={18} /></button></div>
    <div className="study-actions"><button className="button secondary" disabled={busy || run.questions.length < 2} onClick={() => onChange({ ...session, run: { ...run, questions: shuffle(run.questions), index: 0, flipped: false } })}><Shuffle size={17} />Shuffle</button><button className="button secondary" disabled={busy} onClick={() => onChange({ ...session, run: { ...run, options: { ...run.options, direction: run.options.direction === 'forward' ? 'reverse' : 'forward' }, questions: run.questions.map(question => ({ ...question, prompt: question.answer, answer: question.prompt })), flipped: false } })}>Reverse direction</button><button className="button primary" disabled={busy} onClick={() => onChange({ ...session, finishedAt: Date.now() })}>Finish session</button></div>
    <p className="milestone-note">Swipe left/right to move. On desktop: Space to flip, arrow keys to move when no control is focused. Review ratings and scheduling arrive in Milestone 3.</p>
  </div>;
}
