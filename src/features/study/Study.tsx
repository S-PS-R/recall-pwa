import { useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Layers3, PencilLine } from 'lucide-react';
import type { Flashcard, Setting, StudySession, StudySet } from '../../domain/types';
import { continueLearn, createSession, currentQuestion, submitAnswer, type ActiveSession, type StudyOptions } from '../../domain/study';
import { saveSession } from '../../db/study';
import { Flashcards } from '../flashcards/Flashcards';
import { QuestionCard } from '../learn/QuestionCard';
import { Results } from '../test/Results';

const modes = [{ id: 'flashcards', title: 'Flashcards', text: 'Flip, shuffle, and find your rhythm.', icon: Layers3 }, { id: 'learn', title: 'Learn', text: 'Practice with feedback and retries.', icon: BookOpen }, { id: 'test', title: 'Test', text: 'Check what sticks. Review your results.', icon: PencilLine }] as const;
function defaults(settings: Setting[]): StudyOptions {
  try {
    const saved = JSON.parse(settings.find(setting => setting.key === 'study-options')?.value ?? '{}');
    return { direction: saved.direction === 'reverse' ? 'reverse' : 'forward', comparison: saved.comparison === 'strict' ? 'strict' : 'lenient', questionMode: ['choice', 'written'].includes(saved.questionMode) ? saved.questionMode : 'mixed', count: 10 };
  } catch { return { direction: 'forward', comparison: 'lenient', questionMode: 'mixed', count: 10 }; }
}
export function Study({ sets, cards, sessions, settings, setId }: { sets: StudySet[]; cards: Flashcard[]; sessions: StudySession[]; settings: Setting[]; setId?: string }) {
  const set = sets.find(item => item.id === setId);
  const setCards = cards.filter(card => card.setId === setId).sort((a, b) => a.position - b.position);
  const [mode, setMode] = useState<StudySession['mode']>('flashcards');
  const [options, setOptions] = useState<StudyOptions>(() => ({ ...defaults(settings), count: Math.min(10, setCards.length) }));
  const [session, setSession] = useState<ActiveSession>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function change(next: ActiveSession) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await saveSession(next); setSession(next); }
    catch (err) { setError(err instanceof Error ? `Could not save this action: ${err.message}` : 'Could not save. Check available storage and try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!setId) return <><div className="page-heading"><div><span className="eyebrow">A LITTLE PRACTICE, A LITTLE PROGRESS</span><h1>What will you learn today?</h1><p className="muted">Choose a study set to get started.</p></div></div><div className="set-grid">{sets.map(item => <a className="set-tile" key={item.id} href={`#study/${item.id}`}><span className="set-icon tone-0"><BookOpen size={24} /></span><h2>{item.title}</h2><p className="muted text-sm mt-4">Flashcards · Learn · Test</p></a>)}</div>{!sets.length && <div className="empty-state"><h2>Your first session starts with a set.</h2><a className="button primary mt-4" href="#library">Create or import flashcards</a></div>}</>;
  if (!set) return <div className="empty-state"><h1>Set not found</h1><a href="#library" className="button primary mt-4">Return to library</a></div>;
  const saved = sessions.filter(item => item.setId === setId && item.run).sort((a, b) => b.startedAt - a.startedAt);
  const question = session && currentQuestion(session);
  const completed = session?.finishedAt !== undefined;
  return <>
    <a href={`#set/${setId}`} className="text-button back-link"><ArrowLeft size={17} />Back to set</a>
    <div className="page-heading"><div><span className="eyebrow">{session ? modes.find(item => item.id === session.mode)?.title.toUpperCase() : 'STUDY YOUR WAY'}</span><h1>{set.title}</h1><p className="muted">{session ? 'Saved on this device after every action.' : `${setCards.length} flashcards · Ready when you are`}</p></div>{session && !completed && <button className="button secondary" disabled={busy} onClick={() => setSession(undefined)}>Pause session</button>}</div>
    {error && <p role="alert" className="error">{error}</p>}
    {!session ? <>
      <div className="mode-grid" role="group" aria-label="Study mode">{modes.map(item => <button key={item.id} aria-pressed={mode === item.id} className={`mode-option ${mode === item.id ? 'selected' : ''}`} onClick={() => setMode(item.id)}><item.icon size={24} /><strong>{item.title}</strong><span>{item.text}</span></button>)}</div>
      <form className="settings-panel" onSubmit={event => { event.preventDefault(); if (!lock.current) { try { void change(createSession(crypto.randomUUID(), setId, mode, setCards, { ...options, count: mode === 'flashcards' ? setCards.length : options.count }, Date.now())); } catch (err) { setError((err as Error).message); } } }}>
        <div className="study-settings"><label>Study direction<select aria-label="Study direction" value={options.direction} disabled={busy} onChange={event => setOptions({ ...options, direction: event.target.value as StudyOptions['direction'] })}><option value="forward">Term → definition</option><option value="reverse">Definition → term</option></select></label>
          {mode !== 'flashcards' && <><label>Question style<select aria-label="Question style" value={options.questionMode} disabled={busy} onChange={event => setOptions({ ...options, questionMode: event.target.value as StudyOptions['questionMode'] })}><option value="mixed">Mixed</option><option value="choice">Multiple choice</option><option value="written">Written answers</option></select></label><label>Answer matching<select aria-label="Answer matching" value={options.comparison} disabled={busy} onChange={event => setOptions({ ...options, comparison: event.target.value as StudyOptions['comparison'] })}><option value="lenient">Lenient</option><option value="strict">Strict</option></select></label><label>Number of cards<input aria-label="Number of cards" type="number" min={1} max={Math.min(100, setCards.length)} required value={options.count || ''} disabled={busy} onChange={event => setOptions({ ...options, count: Number(event.target.value) })} /></label></>}
        </div>
        {mode !== 'flashcards' && <p className="muted text-sm mt-4">Up to 100 unique cards per session. Lenient matching ignores case, repeated spaces, and Latin accents; Hindi vowel signs remain significant. Strict matching preserves case, accents, and internal spacing. Both ignore outer spaces.</p>}
        {mode === 'learn' && <p className="muted text-sm mt-4">Missed cards return after up to two other questions, with a maximum of three attempts per card. First-attempt accuracy stays separate from retries.</p>}
        {mode === 'test' && <p className="muted text-sm mt-4">Cards are randomized without repeats. Answers are final when submitted. Your score and mistakes appear at the end.</p>}
        <button className="button primary mt-4" disabled={busy || !setCards.length}>{busy ? 'Saving…' : `Start ${modes.find(item => item.id === mode)?.title}`}</button>
      </form>
      {!!saved.length && <section className="saved-sessions"><h2>Pick up where you left off</h2><p className="muted text-sm">Sessions keep the card text from when they started. Start a new session to include edits.</p>{saved.slice(0, 10).map(item => <div className="saved-session" key={item.id}><div><strong>{modes.find(entry => entry.id === item.mode)?.title}</strong><p className="muted text-xs">{new Date(item.startedAt).toLocaleString()} · {item.finishedAt !== undefined ? 'Completed' : 'Paused'}</p></div><button className="button secondary" disabled={busy} onClick={() => { setError(''); setSession(item as ActiveSession); }}>{item.finishedAt !== undefined ? 'View results' : 'Resume'}</button></div>)}</section>}
    </> : completed ? <Results session={session} onDone={() => setSession(undefined)} /> : session.mode === 'flashcards' ? <Flashcards session={session} busy={busy} onChange={next => void change(next)} /> : <div className="study-workspace">
      <div className="row-between"><span className="eyebrow">{session.mode === 'test' ? `QUESTION ${session.run.index + 1} OF ${session.run.questions.length}` : `${session.run.queue.length} QUESTIONS LEFT${session.run.feedback ? ' AFTER FEEDBACK' : ''}`}</span><span className="muted text-sm">{session.run.options.comparison === 'strict' ? 'Strict' : 'Lenient'} matching</span></div>
      {session.run.feedback ? <section className={`answer-feedback ${session.run.feedback.correct ? 'correct' : 'incorrect'}`}><h2 tabIndex={-1} ref={node => node?.focus()}>{session.run.feedback.correct ? 'That’s right.' : 'Keep going—you’re learning.'}</h2><p>{session.run.feedback.prompt}</p><p>Your answer: <strong>{session.run.feedback.given}</strong></p><p>Expected answer: <strong>{session.run.feedback.expected}</strong></p>{!session.run.feedback.correct && <p className="muted text-sm">{session.run.queue.some(index => session.run.questions[index].cardId === session.run.feedback?.cardId) ? 'You’ll see this card again shortly.' : 'Three attempts reached. Review this card in your summary.'}</p>}<button className="button primary mt-4" disabled={busy} onClick={() => void change(continueLearn(session, Date.now()))}>{session.run.queue.length ? 'Continue' : 'See results'}</button></section> : question && <QuestionCard key={`${session.id}-${session.run.answers.length}`} question={question} busy={busy} onAnswer={answer => void change(submitAnswer(session, answer, Date.now()))} />}
    </div>}
  </>;
}
