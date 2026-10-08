import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { createSets, updateSet } from '../../db/database';
import type { Flashcard, StudySet } from '../../domain/types';
import { MAX_CARDS } from '../import/parser';

export function SetEditor({ set, cards = [], onClose, onSaved }: { set?: StudySet; cards?: Flashcard[]; onClose: () => void; onSaved: (id: string) => void }) {
  const [title, setTitle] = useState(set?.title ?? '');
  const [description, setDescription] = useState(set?.description ?? '');
  const [rows, setRows] = useState<{ id?: string; key: string; front: string; back: string }[]>(() => cards.length ? cards.map(card => ({ id: card.id, key: card.id, front: card.front, back: card.back })) : [{ key: crypto.randomUUID(), front: '', back: '' }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, Math.floor((rows.length - 1) / 25));
  const removed = cards.filter(card => !rows.some(row => row.id === card.id)).length;
  function move(index: number, offset: number) {
    const next = [...rows]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; setRows(next);
  }
  return <Dialog title={set ? 'Edit study set' : 'Create a study set'} onClose={onClose} busy={busy}>
    <form onSubmit={async event => {
      event.preventDefault(); setError(''); setBusy(true);
      try {
        if (removed && !confirmed) throw new Error('Confirm the card removal before saving.');
        const draft = { title, description, cards: rows };
        const id = set ? (await updateSet(set.id, draft, rows), set.id) : (await createSets([draft]))[0];
        onSaved(id);
      } catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Check available device storage and try again.'); }
      finally { setBusy(false); }
    }}>
      <fieldset disabled={busy} className="contents">
        <label>Set title<input autoFocus value={title} maxLength={180} onChange={event => setTitle(event.target.value)} required placeholder="e.g. Hindi · Everyday conversations" /></label>
        <label>Description <span className="muted">(optional)</span><textarea value={description} maxLength={1000} onChange={event => setDescription(event.target.value)} rows={2} placeholder="What are you learning?" /></label>
        <p className="muted text-sm">Write the term exactly as you want it to appear. No labels are added. Editing a card’s text resets its future review progress.</p>
        <div className="editor-rows">{rows.slice(currentPage * 25, (currentPage + 1) * 25).map((row, localIndex) => { const index = currentPage * 25 + localIndex; return <section className="editor-card" key={row.key}>
          <div className="row-between"><span className="eyebrow">CARD {index + 1}</span><div className="flex">
            <button type="button" className="icon-button" aria-label={`Move card ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={17} /></button>
            <button type="button" className="icon-button" aria-label={`Move card ${index + 1} down`} disabled={index === rows.length - 1} onClick={() => move(index, 1)}><ArrowDown size={17} /></button>
            <button type="button" className="icon-button danger-text" aria-label={`Remove card ${index + 1}`} disabled={rows.length === 1} onClick={() => { setRows(rows.filter((_, i) => i !== index)); setConfirmed(false); }}><Trash2 size={17} /></button>
          </div></div>
          <div className="card-fields"><label>Term<textarea aria-label={`Card ${index + 1} term`} required rows={2} value={row.front} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, front: event.target.value } : item))} /></label>
            <label>Definition<textarea aria-label={`Card ${index + 1} definition`} required rows={2} value={row.back} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, back: event.target.value } : item))} /></label></div>
        </section>; })}</div>
        {rows.length > 25 && <div className="row-between mb-4"><button type="button" className="button secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous cards</button><span className="muted text-xs">{currentPage * 25 + 1}–{Math.min((currentPage + 1) * 25, rows.length)} of {rows.length}</span><button type="button" className="button secondary" disabled={(currentPage + 1) * 25 >= rows.length} onClick={() => setPage(currentPage + 1)}>Next cards</button></div>}
        <button type="button" className="button secondary w-full" disabled={rows.length >= MAX_CARDS} onClick={() => { setPage(Math.floor(rows.length / 25)); setRows([...rows, { id: undefined, key: crypto.randomUUID(), front: '', back: '' }]); }}><Plus size={18} />Add card</button>
        {removed > 0 && <label className="check-row warning"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Remove {removed} saved card(s) and their review progress when I save.</label>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || (!!removed && !confirmed)}>{busy ? 'Saving…' : 'Save study set'}</button></div>
      </fieldset>
    </form>
  </Dialog>;
}
