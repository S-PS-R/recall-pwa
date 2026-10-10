import { cardKey, type Flashcard } from '../domain/types';
import { createSets, db, updateSet, type SetDraft } from './database';

export type ImportMode = 'new' | 'merge' | 'replace';
export interface ImportPlan { draft: SetDraft; mode: ImportMode; targetId?: string; expectedCards?: string }
export const cardSnapshot = (cards: Flashcard[]) => JSON.stringify(cards.map(c => [c.id, c.normalizedKey, c.position]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
export function reconcileCards(existing: Flashcard[], incoming: SetDraft['cards'], mode: 'merge' | 'replace') {
  const byKey = new Map<string, Flashcard[]>();
  for (const card of existing) byKey.set(card.normalizedKey, [...(byKey.get(card.normalizedKey) ?? []), card]);
  const used = new Set<string>();
  const mapped = incoming.map(card => { const old = byKey.get(cardKey(card))?.shift(); if (old) used.add(old.id); return { ...card, id: old?.id }; });
  const removed = existing.filter(card => !used.has(card.id));
  return { cards: mode === 'merge' ? [...existing, ...mapped.filter(card => !card.id)] : mapped, removed: mode === 'replace' ? removed.length : 0 };
}
export async function importSets(plans: ImportPlan[], database = db) {
  return database.transaction('rw', [database.sets, database.cards, database.progress, database.sessions, database.reviews], async () => {
    const targets = new Set<string>(), ids: string[] = [];
    for (const plan of plans) {
      if (plan.mode === 'new') { ids.push(...await createSets([plan.draft], database)); continue; }
      const target = plan.targetId && await database.sets.get(plan.targetId);
      if (!target || targets.has(target.id)) throw new Error('Choose a different existing set for each file.');
      targets.add(target.id);
      const existing = await database.cards.where('setId').equals(target.id).sortBy('position');
      if (plan.expectedCards !== cardSnapshot(existing)) throw new Error('This set changed while the preview was open. Cancel and select the file again.');
      const result = reconcileCards(existing, plan.draft.cards, plan.mode);
      await updateSet(target.id, { ...plan.draft, description: target.description }, result.cards, database);
      await database.sets.update(target.id, { sourceFilename: plan.draft.sourceFilename, importedAt: Date.now() });
      ids.push(target.id);
    }
    return ids;
  });
}
