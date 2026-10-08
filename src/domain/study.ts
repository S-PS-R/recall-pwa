import type { Flashcard, StudySession } from './types';

export type Direction = 'forward' | 'reverse';
export type Comparison = 'lenient' | 'strict';
export type QuestionMode = 'mixed' | 'choice' | 'written';
export interface StudyOptions { direction: Direction; comparison: Comparison; questionMode: QuestionMode; count: number }
export interface Question { cardId: string; prompt: string; answer: string; accepted: string[]; kind: 'choice' | 'written'; choices: string[] }
export interface Answer { cardId: string; prompt: string; expected: string; given: string; correct: boolean }
export interface StudyRun {
  options: StudyOptions; questions: Question[]; queue: number[]; answers: Answer[];
  index: number; flipped: boolean; visited: string[]; feedback?: Answer;
}
export type ActiveSession = StudySession & { run: StudyRun };

export function normalizeAnswer(value: string, comparison: Comparison) {
  const trimmed = value.trim().normalize('NFC');
  if (comparison === 'strict') return trimmed;
  // Strip accents on Latin letters only. Hindi vowel signs and nukta remain significant.
  return trimmed.normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC').toLowerCase().replace(/\s+/gu, ' ');
}
export function gradeAnswer(given: string, accepted: string[], comparison: Comparison) {
  const normalized = normalizeAnswer(given, comparison);
  return !!normalized && accepted.some(answer => normalizeAnswer(answer, comparison) === normalized);
}
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function createSession(id: string, setId: string, mode: StudySession['mode'], cards: Flashcard[], options: StudyOptions, now: number, random: () => number = Math.random): ActiveSession {
  if (!cards.length) throw new Error('Add at least one card before studying.');
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > cards.length) throw new Error('Choose a question count within this set’s size.');
  const sides = cards.map(card => ({ cardId: card.id, prompt: options.direction === 'forward' ? card.front : card.back, answer: options.direction === 'forward' ? card.back : card.front }));
  const selected = mode === 'flashcards' ? sides : shuffle(sides, random).slice(0, options.count);
  const questions = selected.map((item, index): Question => {
    if (mode === 'flashcards') return { ...item, accepted: [item.answer], kind: 'written', choices: [] };
    const accepted = sides.filter(other => other.prompt.normalize('NFC') === item.prompt.normalize('NFC')).map(other => other.answer);
    const seen = new Set(accepted.map(answer => normalizeAnswer(answer, options.comparison)));
    const distractors = shuffle(sides, random).filter(other => {
      const key = normalizeAnswer(other.answer, options.comparison);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 3).map(other => other.answer);
    const choice = options.questionMode === 'choice' || (options.questionMode === 'mixed' && index % 2 === 0);
    return { ...item, accepted, kind: choice && distractors.length ? 'choice' : 'written', choices: distractors.length ? shuffle([item.answer, ...distractors], random) : [] };
  });
  return { id, setId, mode, startedAt: now, totalQuestions: 0, correctAnswers: 0, run: { options, questions, queue: questions.map((_, i) => i), answers: [], index: 0, flipped: false, visited: [] } };
}
export function currentQuestion(session: ActiveSession) {
  return session.run.questions[session.mode === 'learn' ? session.run.queue[0] : session.run.index];
}
export function submitAnswer(session: ActiveSession, given: string, now: number): ActiveSession {
  if (session.finishedAt !== undefined || session.run.feedback || session.mode === 'flashcards') return session;
  const question = currentQuestion(session);
  if (!question) return session;
  const answer: Answer = { cardId: question.cardId, prompt: question.prompt, expected: question.answer, given: given.trim(), correct: gradeAnswer(given, question.accepted, session.run.options.comparison) };
  const answers = [...session.run.answers, answer];
  let queue = session.run.queue;
  if (session.mode === 'learn') {
    queue = queue.slice(1);
    // Retry after two other questions, at most three attempts per card in a session.
    if (!answer.correct && answers.filter(item => item.cardId === question.cardId).length < 3) {
      queue.splice(Math.min(2, queue.length), 0, session.run.queue[0]);
    }
  }
  const index = session.mode === 'test' ? session.run.index + 1 : session.run.index;
  return { ...session, totalQuestions: answers.length, correctAnswers: answers.filter(item => item.correct).length,
    finishedAt: session.mode === 'test' && index === session.run.questions.length ? now : undefined,
    run: { ...session.run, answers, queue, index, feedback: session.mode === 'learn' ? answer : undefined } };
}
export function continueLearn(session: ActiveSession, now: number): ActiveSession {
  if (!session.run.feedback) return session;
  return { ...session, finishedAt: session.run.queue.length ? undefined : now, run: { ...session.run, feedback: undefined } };
}
export function firstAttemptScore(session: ActiveSession) {
  const first = new Map<string, Answer>();
  for (const answer of session.run.answers) if (!first.has(answer.cardId)) first.set(answer.cardId, answer);
  return { correct: [...first.values()].filter(answer => answer.correct).length, total: first.size };
}
