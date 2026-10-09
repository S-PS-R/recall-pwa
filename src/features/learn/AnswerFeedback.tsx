import { useEffect, useRef } from 'react';
import { CheckCircle2, CircleAlert, ArrowRight } from 'lucide-react';
import type { Answer } from '../../domain/study';

export function AnswerFeedback({ answer, retry, last, busy, onContinue }: { answer: Answer; retry: boolean; last: boolean; busy: boolean; onContinue: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className={`answer-feedback feedback-compact ${answer.correct ? 'correct' : 'incorrect'}`} onKeyDown={event => { if (event.key === 'Enter' && !event.repeat && !(event.target as HTMLElement).closest('button') && !busy) { event.preventDefault(); onContinue(); } }}>
    <div className="feedback-heading">{answer.correct ? <CheckCircle2 aria-hidden="true" size={28} /> : <CircleAlert aria-hidden="true" size={28} />}<h2 ref={heading} tabIndex={-1}>{answer.correct ? 'That’s right.' : 'Let’s try that again.'}</h2></div>
    {answer.correct ? <p className="confirmed-answer">{answer.given}</p> : <><p>{answer.prompt}</p><p>Your answer: <strong>{answer.given}</strong></p><p>Expected answer: <strong>{answer.expected}</strong></p><p className="muted text-sm">{retry ? 'You’ll see this card again shortly.' : 'Three attempts reached. Review this card in your summary.'}</p></>}
    <button className="button primary feedback-next" disabled={busy} onClick={onContinue}>{last ? 'See results' : answer.correct ? 'Next question' : 'Continue'}<ArrowRight size={18} /></button>
    <span className="muted text-xs">Press Enter or tap to continue.</span>
  </section>;
}
