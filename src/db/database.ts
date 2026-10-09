import Dexie, { type Table } from 'dexie';
import { cardKey, type CardInput, type CardProgress, type Flashcard, type Folder, type Setting, type StudySession, type StudySet } from '../domain/types';
import { MAX_CARDS } from '../features/import/parser';
import type { ReviewEvent } from '../domain/scheduler';

export class RecallDatabase extends Dexie {
  folders!: Table<Folder, string>;
  sets!: Table<StudySet, string>;
  cards!: Table<Flashcard, string>;
  progress!: Table<CardProgress, string>;
  sessions!: Table<StudySession, string>;
  settings!: Table<Setting, string>;
  reviews!: Table<ReviewEvent, string>;
  constructor(name = 'recall-library') {
    super(name);
    this.version(1).stores({ folders: 'id, parentId', sets: 'id, folderId, updatedAt', cards: 'id, setId, [setId+position]', progress: 'cardId, dueAt, state', sessions: 'id, setId, startedAt', settings: 'key' });
    this.version(2).stores({ cards: 'id, setId, [setId+position], normalizedKey' }).upgrade(tx => tx.table('cards').toCollection().modify(card => { card.normalizedKey = cardKey(card); }));
    this.version(3).stores({ reviews: 'id, cardId, setId, sessionId, reviewedAt' });
  }
}
export const db = new RecallDatabase();
export interface SetDraft { title: string; description?: string; folderId?: string; sourceFilename?: string; cards: CardInput[] }
function validateDraft(draft: SetDraft) {
  if (!draft.title.trim()) throw new Error('Give your study set a title.');
  if (!draft.cards.length || draft.cards.length > MAX_CARDS) throw new Error('A study set needs 1–5,000 cards.');
  if (draft.cards.some(card => !card.front.trim() || !card.back.trim())) throw new Error('Every card needs a term and a definition.');
}
export async function createSets(drafts: SetDraft[], database = db) {
  drafts.forEach(validateDraft);
  return database.transaction('rw', database.sets, database.cards, async () => {
    const ids: string[] = [];
    for (const draft of drafts) {
      const id = crypto.randomUUID(), now = Date.now();
      await database.sets.add({ id, title: draft.title.trim(), description: draft.description?.trim(), folderId: draft.folderId, sourceFilename: draft.sourceFilename, importedAt: draft.sourceFilename ? now : undefined, createdAt: now, updatedAt: now });
      await database.cards.bulkAdd(draft.cards.map((card, position) => ({ id: crypto.randomUUID(), setId: id, front: card.front.trim(), back: card.back.trim(), normalizedKey: cardKey(card), position, createdAt: now, updatedAt: now })));
      ids.push(id);
    }
    return ids;
  });
}
export async function updateSet(id: string, draft: SetDraft, cards: (CardInput & { id?: string })[], database = db) {
  validateDraft({ ...draft, cards });
  await database.transaction('rw', [database.sets, database.cards, database.progress, database.sessions, database.reviews], async () => {
    if (!await database.sets.get(id)) throw new Error('This set no longer exists. Return to your library.');
    const existing = await database.cards.where('setId').equals(id).toArray();
    const byId = new Map(existing.map(card => [card.id, card]));
    const used = new Set<string>();
    const now = Date.now();
    const next = cards.map((card, position) => {
      const old = card.id ? byId.get(card.id) : undefined;
      if (card.id && (!old || used.has(card.id))) throw new Error('Invalid card identity. Reopen the set and try again.');
      const cardId = old?.id ?? crypto.randomUUID(); used.add(cardId);
      return { id: cardId, setId: id, front: card.front.trim(), back: card.back.trim(), normalizedKey: cardKey(card), position, createdAt: old?.createdAt ?? now, updatedAt: now };
    });
    const nextById = new Map(next.map(card => [card.id, card]));
    const changedOrRemoved = existing.filter(old => nextById.get(old.id)?.normalizedKey !== old.normalizedKey);
    await database.progress.bulkDelete(changedOrRemoved.map(card => card.id));
    await database.reviews.where('cardId').anyOf(changedOrRemoved.map(card => card.id)).delete();
    await database.cards.bulkDelete(existing.filter(card => !used.has(card.id)).map(card => card.id));
    await database.cards.bulkPut(next);
    await database.sets.update(id, { title: draft.title.trim(), description: draft.description?.trim(), updatedAt: now });
  });
}
export async function deleteSet(id: string, database = db) {
  await database.transaction('rw', [database.sets, database.cards, database.progress, database.sessions, database.reviews], async () => {
    const ids = await database.cards.where('setId').equals(id).primaryKeys();
    await database.progress.bulkDelete(ids);
    await database.cards.bulkDelete(ids);
    await database.sessions.where('setId').equals(id).delete();
    await database.reviews.where('setId').equals(id).delete();
    await database.sets.delete(id);
  });
}
export async function resetLibrary(database = db) {
  await database.transaction('rw', database.tables, async () => { for (const table of database.tables) await table.clear(); });
}
