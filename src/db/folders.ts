import { db } from './database';
export async function saveFolder(name: string, id?: string, database = db) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 180) throw new Error('Use a folder name between 1 and 180 characters.');
  const now = Date.now();
  if (id) { if (!await database.folders.update(id, { name: trimmed, updatedAt: now })) throw new Error('This folder no longer exists.'); }
  else await database.folders.add({ id: crypto.randomUUID(), name: trimmed, createdAt: now, updatedAt: now });
}
export async function moveSet(id: string, folderId: string, database = db) {
  await database.transaction('rw', database.folders, database.sets, async () => {
    if (folderId && !await database.folders.get(folderId)) throw new Error('This folder no longer exists.');
    if (!await database.sets.update(id, { folderId: folderId || undefined, updatedAt: Date.now() })) throw new Error('This set no longer exists.');
  });
}
export async function deleteFolder(id: string, database = db) {
  await database.transaction('rw', database.folders, database.sets, async () => {
    await database.sets.where('folderId').equals(id).modify({ folderId: undefined });
    await database.folders.where('parentId').equals(id).modify({ parentId: undefined });
    await database.folders.delete(id);
  });
}
