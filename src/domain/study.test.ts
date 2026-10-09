import { describe, expect, it } from 'vitest';
import { continueLearn, createSession, currentQuestion, firstAttemptScore, gradeAnswer, normalizeAnswer, shuffle, submitAnswer, type StudyOptions } from './study';
import type { Flashcard } from './types';
const cards: Flashcard[] = ['Hello', 'Boy', 'Girl', 'Thanks'].map((back, index) => ({ id: String(index), setId: 'set', front: ['नमस्ते', 'लड़का', 'लड़की', 'धन्यवाद'][index], back, position: index, normalizedKey: '', createdAt: 0, updatedAt: 0 }));
const options: StudyOptions = { count: 4, direction: 'forward', comparison: 'lenient', questionMode: 'mixed' };
const make = (mode: 'test' | 'learn' | 'flashcards' = 'test', opts = options, input = cards) => createSession('run', 'set', mode, input, opts, 100, () => .5);
describe('answer matching', () => {
  it('ignores Latin accents, case and repeated whitespace in lenient mode', () => {
    expect(gradeAnswer('  CAFÉ   au lait ', ['cafe au lait'], 'lenient')).toBe(true);
    expect(gradeAnswer('café', ['cafe'], 'strict')).toBe(false);
    expect(gradeAnswer('Hello', ['hello'], 'strict')).toBe(true);
    expect(gradeAnswer('two  words', ['two words'], 'strict')).toBe(false);
    expect(gradeAnswer(' e\u0301 ', ['é'], 'strict')).toBe(true);
    expect(gradeAnswer(' ', [''], 'lenient')).toBe(false);
  });
  it('preserves Hindi vowel signs, nukta and punctuation', () => {
    expect(normalizeAnswer('लड़की', 'lenient')).toBe('लड़की'.normalize('NFC'));
    expect(gradeAnswer('लडकी', ['लड़की'], 'lenient')).toBe(false);
    expect(gradeAnswer('लड़क', ['लड़की'], 'lenient')).toBe(false);
    expect(gradeAnswer('hello', ['hello!'], 'lenient')).toBe(true);
  });
  it('ignores case and Unicode punctuation in both modes without losing meaningful symbols', () => {
    for (const mode of ['strict', 'lenient'] as const) {
      expect(gradeAnswer('HOW are you', ['How are you?'], mode)).toBe(true);
      expect(gradeAnswer('im fine', ['I’m fine!'], mode)).toBe(true);
      expect(gradeAnswer('नमस्ते', ['नमस्ते।'], mode)).toBe(true);
      expect(gradeAnswer('!!!', ['?'], mode)).toBe(false);
      expect(gradeAnswer('15', ['1.5'], mode)).toBe(false);
      expect(gradeAnswer('1', ['-1'], mode)).toBe(false);
      expect(gradeAnswer('2', ['2+'], mode)).toBe(false);
    }
  });
});
describe('question generation and scoring', () => {
  it('randomizes unique cards without changing input and respects count/direction', () => {
    const original = [...cards]; const session = make('test', { ...options, count: 3, direction: 'reverse' });
    expect(session.run.questions).toHaveLength(3);
    expect(new Set(session.run.questions.map(q => q.cardId)).size).toBe(3);
    expect(session.run.questions[0].prompt).toBe(cards.find(c => c.id === session.run.questions[0].cardId)!.back);
    expect(cards).toEqual(original); expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
    expect(() => make('test', { ...options, count: 5 })).toThrow('count');
    expect(() => make('test', options, [])).toThrow('at least');
  });
  it('uses distinct real answers and falls back to written for tiny or identical-answer sets', () => {
    for (const q of make('test', { ...options, questionMode: 'choice' }).run.questions) {
      expect(q.choices).toHaveLength(4); expect(q.choices).toContain(q.answer);
      expect(q.choices.every(choice => cards.some(card => card.back === choice))).toBe(true);
    }
    expect(make('test', { ...options, count: 1 }, cards.slice(0, 1)).run.questions[0].kind).toBe('written');
    expect(make('test', options, cards.map(c => ({ ...c, back: 'Same' }))).run.questions.every(q => q.kind === 'written')).toBe(true);
  });
  it('accepts alternate definitions for identical prompts and excludes them as distractors', () => {
    const input = [cards[0], { ...cards[1], front: cards[0].front, back: 'Greetings' }, cards[2]];
    const session = make('test', { ...options, count: 3, questionMode: 'choice' }, input);
    const q = session.run.questions.find(q => q.cardId === '0')!;
    expect(q.accepted).toEqual(['Hello', 'Greetings']); expect(q.choices).not.toContain('Greetings');
    expect(gradeAnswer('Greetings', q.accepted, 'lenient')).toBe(true);
  });
  it('retries after two questions, keeps first-attempt score and ends after three failures per card', () => {
    let session = make('learn'); const missed = currentQuestion(session).cardId;
    session = submitAnswer(session, 'wrong', 200);
    expect(session.run.questions[session.run.queue[2]].cardId).toBe(missed);
    expect(submitAnswer(session, 'again', 201)).toBe(session);
    session = continueLearn(session, 202);
    while (session.finishedAt === undefined) { session = continueLearn(submitAnswer(session, 'wrong', 300), 301); }
    expect(session.totalQuestions).toBe(12); expect(session.correctAnswers).toBe(0);
    expect(firstAttemptScore(session)).toEqual({ correct: 0, total: 4 });
    expect(submitAnswer(session, 'x', 400)).toBe(session);
  });
  it('counts a successful retry separately from the initial score', () => {
    let session = make('learn', { ...options, count: 1 }, cards.slice(0, 1));
    session = continueLearn(submitAnswer(session, 'wrong', 200), 201);
    session = continueLearn(submitAnswer(session, 'Hello', 202), 203);
    expect(session.finishedAt).toBe(203); expect(session.correctAnswers).toBe(1); expect(session.totalQuestions).toBe(2);
    expect(firstAttemptScore(session)).toEqual({ correct: 0, total: 1 });
  });
  it('completes a unique-card test with exact scores and no early feedback', () => {
    let session = make();
    session = submitAnswer(session, 'wrong', 200); expect(session.run.feedback).toBeUndefined();
    while (session.finishedAt === undefined) session = submitAnswer(session, currentQuestion(session).answer, 300);
    expect(session.correctAnswers).toBe(3); expect(session.totalQuestions).toBe(4); expect(session.finishedAt).toBe(300);
    expect(new Set(session.run.answers.map(a => a.cardId)).size).toBe(4);
  });
});
