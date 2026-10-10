import { useRef, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { downloadFile } from '../../utils/files';
import { exportBackup, MAX_BACKUP_BYTES, parseBackup, restoreBackup, type Backup } from './backup';

export function BackupPanel({ onDialogChange }: { onDialogChange: (open: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<Backup | null>(null), [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  function close() { setBackup(null); onDialogChange(false); }
  return <section className="settings-panel"><h2>Library backup</h2><p>Save a complete copy of your sets, folders, review progress, preferences, and study history. Transfer this file yourself to another device; there is no automatic sync.</p>
    <div className="action-wrap"><button className="button primary" disabled={busy} onClick={async () => {
      setBusy(true); setError(''); onDialogChange(true);
      try { const content = JSON.stringify(await exportBackup()); parseBackup(content); downloadFile(content, `recall-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json'); setMessage('Backup download started. On iPhone, open the download and use Share → Save to Files to keep it in Files or Google Drive.'); }
      catch (e) { setError(e instanceof Error ? e.message : 'Backup could not be exported. Try again.'); }
      finally { setBusy(false); onDialogChange(false); }
    }}>Export library backup</button><button className="button secondary" disabled={busy} onClick={() => input.current?.click()}>Restore backup</button></div>
    <input ref={input} className="sr-only" type="file" accept=".json,application/json" aria-label="Choose library backup" tabIndex={-1} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      setBusy(true); setError(''); setMessage(''); onDialogChange(true);
      try { if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 25 MiB.'); setBackup(parseBackup(await file.text())); setMode('merge'); setConfirmed(false); }
      catch (e) { setError(e instanceof Error ? e.message : 'Could not read this backup.'); onDialogChange(false); }
      finally { setBusy(false); }
    }} />
    {busy && !backup && <p role="status">Preparing your file…</p>}{message && <p role="status" className="notice">{message}</p>}{error && !backup && <p role="alert" className="error">{error}</p>}
    {backup && <Dialog title="Restore library backup" busy={busy} onClose={close}><p>Backup from {new Date(backup.exportedAt).toLocaleString()}: {backup.sets.length} sets, {backup.cards.length} cards, {backup.folders.length} folders, {backup.progress.length} card schedules, {backup.sessions.length} sessions, and {backup.reviews.length} reviews.</p>
      <label>Restore method<select disabled={busy} value={mode} onChange={e => { setMode(e.target.value as typeof mode); setConfirmed(false); }}><option value="merge">Merge — add separate copies</option><option value="replace">Replace — remove this device’s library</option></select></label>
      <p className={mode === 'replace' ? 'warning' : 'notice'}>{mode === 'merge' ? 'Existing sets, progress, and preferences stay unchanged. Every backed-up set and folder is added as a separate copy, even if its name already exists. Repeating this creates duplicates.' : 'All current sets, folders, progress, preferences, and history will be removed and replaced by this backup. Export your current library first. This cannot be undone.'}</p>
      <label className="check-row"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{mode === 'replace' ? 'Replace all current library data with this backup.' : 'Add the backup as separate copies.'}</label>
      {error && <p role="alert" className="error">{error}</p>}<div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={close}>Cancel</button><button className={`button ${mode === 'replace' ? 'danger' : 'primary'}`} disabled={busy || !confirmed} onClick={async () => {
        setBusy(true); setError(''); try { await restoreBackup(backup, mode); close(); setMessage('Backup restored on this device. Your saved study sessions and review dates are ready in Library and Study.'); }
        catch (e) { setError(`${e instanceof Error ? e.message : 'Restore failed.'} Your library was not changed.`); } finally { setBusy(false); }
      }}>{busy ? 'Restoring…' : 'Confirm restore'}</button></div>
    </Dialog>}
  </section>;
}
