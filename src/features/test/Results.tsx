import { firstAttemptScore, type ActiveSession } from '../../domain/study';
export function Results({ session, onDone }: { session: ActiveSession; onDone: () => void }) {
  const score = firstAttemptScore(session);
  const mistakes = session.run.answers.filter(answer => !answer.correct);
  return <section className="study-results"><span className="eyebrow">SESSION COMPLETE</span><h2>{session.mode === 'flashcards' ? 'A little more familiar.' : 'Here’s how you did.'}</h2>
    {session.mode === 'flashcards' ? <p className="result-score">{session.run.visited.length} / {session.run.questions.length}<span>cards revealed</span></p> : <><p className="result-score">{score.correct} / {score.total}<span>correct {session.mode === 'learn' ? 'on the first attempt' : `· ${Math.round(score.correct / Math.max(1, score.total) * 100)}%`}</span></p>{session.mode === 'learn' && <p className="muted">{session.correctAnswers} correct across {session.totalQuestions} attempts, including retries.</p>}</>}
    <p className="muted">This is a session result, not a measure of long-term mastery.</p><button className="button primary mt-4" onClick={onDone}>Back to study options</button>
    {mistakes.length > 0 && <div className="mistake-review"><h3>Review your mistakes</h3>{mistakes.map((answer, index) => <article className="mistake" key={index}><strong>{answer.prompt}</strong><p>Your answer: <span>{answer.given}</span></p><p>Expected: <strong>{answer.expected}</strong></p></article>)}</div>}
  </section>;
}
