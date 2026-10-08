import { useEffect, useRef, useState } from 'react';
import type { Question } from '../../domain/study';

export function QuestionCard({ question, busy, onAnswer }: { question: Question; busy: boolean; onAnswer: (answer: string) => void }) {
  const [answer, setAnswer] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  return <section className="question-card">
    <span className="eyebrow">{question.kind === 'choice' ? 'CHOOSE THE MATCHING ANSWER' : 'WRITE THE MATCHING ANSWER'}</span>
    <h2 ref={title} tabIndex={-1} className="question-prompt">{question.prompt}</h2>
    {question.kind === 'choice' ? <div className="answer-choices">{question.choices.map((choice, index) => <button className="answer-choice" disabled={busy} key={index} onClick={() => onAnswer(choice)}><span>{String.fromCharCode(65 + index)}</span><span>{choice}</span></button>)}</div> : <form onSubmit={event => { event.preventDefault(); if (answer.trim() && !busy) onAnswer(answer); }}><label>Your answer<input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} value={answer} onChange={event => setAnswer(event.target.value)} disabled={busy} /></label><button className="button primary mt-4" disabled={busy || !answer.trim()}>Submit answer</button>{question.choices.length === 0 && <p className="muted text-xs mt-4">Written answer: this set has no distinct incorrect choices for this prompt.</p>}</form>}
  </section>;
}
