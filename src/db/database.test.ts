import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createSets, deleteSet, RecallDatabase, resetLibrary, updateSet } from './database';
import { cardKey } from '../domain/types';
const databases: RecallDatabase[] = [];
const fresh = () => { const db = new RecallDatabase(`test-${crypto.randomUUID()}`); databases.push(db); return db; };
afterEach(async () => { for (const db of databases) await db.delete(); databases.length = 0; });
const draft = { title: 'Hindi', cards: [{ front: 'नमस्ते', back: 'Hello' }, { front: 'लड़का', back: 'Boy' }] };
describe('persistent library', () => {
  it('creates separate sets and survives closing and reopening', async () => {
    const db = fresh();
    const ids = await createSets([draft, { ...draft, title: 'Another set' }], db);
    db.close(); await db.open();
    expect(await db.sets.count()).toBe(2);
    expect(await db.cards.count()).toBe(4);
    expect((await db.cards.where('setId').equals(ids[0]).sortBy('position')).map(card => card.front)).toEqual(['नमस्ते', 'लड़का']);
  });
  it('validates the whole batch before saving anything', async () => {
    const db = fresh();
    await expect(createSets([draft, { title: '', cards: draft.cards }], db)).rejects.toThrow('title');
    expect(await db.sets.count()).toBe(0);
    await expect(createSets([{ title: 'Empty', cards: [] }], db)).rejects.toThrow('1–5,000');
  });
  it('preserves unchanged card IDs and progress when reordering, resets edited progress, removes deleted progress', async () => {
    const db = fresh(); const [id] = await createSets([draft], db);
    const cards = await db.cards.where('setId').equals(id).sortBy('position');
    await db.progress.bulkAdd(cards.map(card => ({ cardId: card.id, repetitions: 2, intervalDays: 3, state: 'review', correctCount: 2, incorrectCount: 0 })));
    await updateSet(id, { ...draft, title: 'Renamed' }, [cards[1], cards[0]], db);
    expect(await db.progress.count()).toBe(2);
    expect((await db.cards.where('setId').equals(id).sortBy('position'))[0].id).toBe(cards[1].id);
    await updateSet(id, draft, [{ ...cards[0], back: 'Greetings' }], db);
    expect(await db.progress.count()).toBe(0);
    expect(await db.cards.count()).toBe(1);
    expect((await db.cards.get(cards[0].id))?.back).toBe('Greetings');
  });
  it('rolls back the entire import when a write fails', async () => {
    const db = fresh();
    db.sets.hook('creating', (_key, value) => { if (value.title === 'Fail') throw new Error('Simulated storage failure'); });
    await expect(createSets([draft, { ...draft, title: 'Fail' }], db)).rejects.toThrow('storage failure');
    expect(await db.sets.count()).toBe(0); expect(await db.cards.count()).toBe(0);
  });
  it('cascades set deletion without touching another set', async () => {
    const db = fresh(); const [id, other] = await createSets([draft, draft], db);
    const card = (await db.cards.where('setId').equals(id).toArray())[0];
    await db.progress.add({ cardId: card.id, repetitions: 0, intervalDays: 0, state: 'new', correctCount: 0, incorrectCount: 0 });
    await db.sessions.add({ id: 'session', setId: id, mode: 'flashcards', startedAt: 0, totalQuestions: 0, correctAnswers: 0 });
    await deleteSet(id, db);
    expect(await db.sets.get(id)).toBeUndefined(); expect(await db.sets.get(other)).toBeDefined();
    expect(await db.cards.count()).toBe(2); expect(await db.progress.count()).toBe(0); expect(await db.sessions.count()).toBe(0);
  });
  it('rejects foreign card identities without partial updates', async () => {
    const db = fresh(); const [id] = await createSets([draft], db);
    await expect(updateSet(id, draft, [{ ...draft.cards[0], id: 'foreign' }], db)).rejects.toThrow('identity');
    expect(await db.cards.count()).toBe(2);
  });
  it('migrates v1 keys without altering text, IDs or progress', async () => {
    const db = fresh(), old = new Dexie(db.name);
    old.version(1).stores({ folders: 'id, parentId', sets: 'id, folderId, updatedAt', cards: 'id, setId, [setId+position]', progress: 'cardId, dueAt, state', sessions: 'id, setId, startedAt', settings: 'key' });
    const legacyCard = { id: 'legacy', setId: 'set', front: 'नमस्ते', back: 'Hello', position: 0, createdAt: 1, updatedAt: 1 };
    await old.table('cards').add(legacyCard); await old.table('progress').add({ cardId: 'legacy', repetitions: 3 }); old.close();
    await db.open();
    expect(await db.cards.get('legacy')).toEqual({ ...legacyCard, normalizedKey: cardKey(legacyCard) });
    expect((await db.progress.get('legacy'))?.repetitions).toBe(3);
  });
  it('resets all tables together and remains writable', async () => {
    const db = fresh(); await createSets([draft], db); await db.settings.put({ key: 'theme', value: 'dark' });
    await resetLibrary(db);
    for (const table of db.tables) expect(await table.count()).toBe(0);
    await createSets([draft], db); expect(await db.sets.count()).toBe(1);
  });
});
