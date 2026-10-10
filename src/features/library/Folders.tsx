import { useState } from 'react';
import type { Folder, StudySet } from '../../domain/types';
import { deleteFolder, saveFolder } from '../../db/folders';
import { Dialog } from '../../components/Dialog';
export function Folders({ folders, sets, onDialogChange }: { folders: Folder[]; sets: StudySet[]; onDialogChange: (open: boolean) => void }) {
  const [editing, setEditing] = useState<Folder | 'new' | null>(null), [removing, setRemoving] = useState(false), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  function open(folder: Folder | 'new', remove = false) { setEditing(folder); setRemoving(remove); setName(folder === 'new' ? '' : folder.name); setError(''); onDialogChange(true); }
  function close() { setEditing(null); onDialogChange(false); }
  return <section className="settings-panel"><div className="row-between"><h2>Folders</h2><button className="button secondary" onClick={() => open('new')}>Add folder</button></div><p className="muted">Organize sets here. Open a study set to move it into a folder.</p>
    {folders.map(folder => <div className="folder-row" key={folder.id}><span><strong>{folder.name}</strong> · {sets.filter(s => s.folderId === folder.id).length} sets</span><div className="action-wrap"><button className="text-button" aria-label={`Rename folder ${folder.name}`} onClick={() => open(folder)}>Rename</button><button className="text-button danger-text" aria-label={`Delete folder ${folder.name}`} onClick={() => open(folder, true)}>Delete</button></div></div>)}
    {editing && <Dialog title={removing ? 'Delete folder?' : editing === 'new' ? 'Add folder' : 'Rename folder'} busy={busy} onClose={close}>
      {removing ? <p>Remove “{name}”? Its sets and their progress will be kept in Unfiled. Any child folders will become top-level folders.</p> : <label>Folder name<input maxLength={180} value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label>}
      {error && <p role="alert" className="error">{error}</p>}<div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={close}>Cancel</button><button className={`button ${removing ? 'danger' : 'primary'}`} disabled={busy || !name.trim()} onClick={async () => { setBusy(true); try { if (removing && editing !== 'new') await deleteFolder(editing.id); else await saveFolder(name, editing === 'new' ? undefined : editing.id); close(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save folder changes.'); } finally { setBusy(false); } }}>{busy ? 'Saving…' : removing ? 'Delete folder and keep sets' : 'Save folder'}</button></div>
    </Dialog>}
  </section>;
}
