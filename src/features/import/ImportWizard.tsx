import { useEffect, useState } from 'react';
import { Check, FileText, AlertCircle } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { cardSnapshot, importSets, reconcileCards, type ImportMode } from '../../db/imports';
import type { Flashcard, StudySet } from '../../domain/types';
import { MAX_FILES, readImportFile, type ParseResult } from './parser';

interface Preview { filename: string; title: string; result: ParseResult; selected: boolean; acknowledged: boolean; duplicateConfirmed: boolean; mode: ImportMode; targetId: string }
export function ImportWizard({ files, sets, cards, targetId, onClose, onSaved }: { files: File[]; sets: StudySet[]; cards: Flashcard[]; targetId?: string; onClose: () => void; onSaved: (ids: string[], count: number) => void }) {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [originalCards] = useState(cards);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (files.length > MAX_FILES) { setError(`Choose up to ${MAX_FILES} files at a time. No files have been imported.`); setLoading(false); return; }
      const rows: Preview[] = [];
      // Read sequentially to bound peak memory on mobile. File contents never leave this device.
      for (const file of files) {
        const result = await readImportFile(file);
        if (cancelled) return;
        rows.push({ filename: file.name, title: file.name.replace(/\.(txt|tsv)$/i, ''), result, selected: !result.fatal, acknowledged: false, duplicateConfirmed: false, mode: 'new', targetId: targetId ?? '' });
      }
      if (!cancelled) { setPreviews(rows); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [files, targetId]);
  const matches = (preview: Preview) => sets.some(set => set.title.trim().toLocaleLowerCase() === preview.title.trim().toLocaleLowerCase() || set.sourceFilename === preview.filename) || previews.some(other => other !== preview && other.selected && other.title.trim().toLocaleLowerCase() === preview.title.trim().toLocaleLowerCase());
  const chosen = previews.filter(preview => preview.selected && !preview.result.fatal);
  const count = chosen.reduce((total, preview) => total + preview.result.cards.length, 0);
  const ready = chosen.length > 0 && chosen.every(preview => preview.title.trim() && (!preview.result.issues.length || preview.acknowledged) && (preview.mode === 'new' ? (!matches(preview) || preview.duplicateConfirmed) : !!preview.targetId && preview.duplicateConfirmed));
  function update(index: number, changes: Partial<Preview>) { setPreviews(current => current.map((preview, i) => i === index ? { ...preview, ...changes } : preview)); }
  const existingCards = (preview: Preview) => originalCards.filter(c => c.setId === preview.targetId).sort((a, b) => a.position - b.position);
  return <Dialog title="Preview your import" onClose={onClose} busy={busy}>
    <p className="muted">One file, one study set. Everything is read on this device and saved only when you confirm.</p>
    {loading && <p role="status" className="notice">Reading and checking your files…</p>}
    <fieldset disabled={busy} className="contents">
      {previews.map((preview, index) => <section className="import-preview" key={index}>
        <div className="row-between"><div className="file-name"><FileText size={18} /><span>{preview.filename}</span></div><label className="check-row"><input type="checkbox" aria-label={`Import ${preview.filename}`} disabled={!!preview.result.fatal} checked={preview.selected} onChange={event => update(index, { selected: event.target.checked })} />Include</label></div>
        {preview.result.fatal ? <p role="alert" className="error"><AlertCircle size={18} />{preview.result.fatal}</p> : <>
          <label>Study set title<input value={preview.title} maxLength={180} onChange={event => update(index, { title: event.target.value, duplicateConfirmed: false })} /></label>
          <div className="import-counts"><span><Check size={15} />{preview.result.cards.length} accepted</span><span>{preview.result.issues.length} invalid</span><span>{preview.result.duplicates} duplicates skipped</span></div>
          <div className="preview-table">{preview.result.cards.slice(0, 3).map((card, i) => <div key={i}><span>{card.front}</span><span>{card.back}</span></div>)}</div>
          <p className="muted text-xs">First {Math.min(3, preview.result.cards.length)} cards · Additional tabs stay in the definition.</p>
          {!!sets.length && <><label>Import action<select value={preview.mode} onChange={e => update(index, { mode: e.target.value as ImportMode, duplicateConfirmed: false })}><option value="new">Import as new</option><option value="merge">Merge into existing set</option><option value="replace">Replace existing set’s cards</option></select></label>
          {preview.mode !== 'new' && <label>Destination set<select value={preview.targetId} onChange={e => update(index, { targetId: e.target.value, duplicateConfirmed: false })}><option value="">Choose a set</option>{sets.map(set => <option key={set.id} value={set.id}>{set.title} · {set.id.slice(0, 8)}</option>)}</select></label>}</>}
          {(matches(preview) || preview.mode !== 'new') && <div className="warning"><p>{preview.mode === 'new' ? 'A set with this title or source already exists, or is included in this import.' : preview.mode === 'merge' ? 'Keep existing cards and their order; append new pairs. Unchanged cards keep their progress and history.' : `Use the file’s card order. Remove ${preview.targetId ? reconcileCards(existingCards(preview), preview.result.cards, 'replace').removed : 0} existing cards and their review progress. Unchanged pairs keep their progress; changed pairs become new cards. Historical sessions remain.`}</p><label className="check-row"><input type="checkbox" checked={preview.duplicateConfirmed} onChange={event => update(index, { duplicateConfirmed: event.target.checked })} />{preview.mode === 'new' ? 'Import as a new, separate set. Keep existing sets.' : preview.mode === 'merge' ? 'Merge these cards into the selected set.' : 'Replace the selected set’s cards and remove missing cards.'}</label></div>}
          {!!preview.result.issues.length && <label className="check-row warning"><input type="checkbox" checked={preview.acknowledged} onChange={event => update(index, { acknowledged: event.target.checked })} />Import valid cards and skip the {preview.result.issues.length} invalid row(s).</label>}
        </>}
        {!!preview.result.issues.length && <details><summary>Row errors ({preview.result.issues.length})</summary><ul className="issue-list">{preview.result.issues.slice(0, 100).map(issue => <li key={issue.line}>Line {issue.line}: {issue.message}</li>)}</ul>{preview.result.issues.length > 100 && <p>Showing the first 100 errors. Fix these and choose the file again.</p>}</details>}
      </section>)}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="dialog-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!ready || loading || busy} onClick={async () => {
        setBusy(true); setError('');
        try { const ids = await importSets(chosen.map(preview => ({ draft: { title: preview.title, sourceFilename: preview.filename, cards: preview.result.cards }, mode: preview.mode, targetId: preview.targetId, expectedCards: cardSnapshot(existingCards(preview)) }))); onSaved(ids, count); }
        catch (e) { setError(`${e instanceof Error ? e.message : 'Import could not be saved.'} Nothing was imported.`); }
        finally { setBusy(false); }
      }}>{busy ? 'Saving…' : `Import ${count} cards${chosen.length > 1 ? ` in ${chosen.length} sets` : ''}`}</button></div>
    </fieldset>
  </Dialog>;
}
