import { ArrowUpRight, BookOpen, FilePlus2, Layers3, Search, Upload } from 'lucide-react';
import { useState } from 'react';
import type { CardProgress, Flashcard, StudySet } from '../../domain/types';
import { SetProgress } from '../progress/SetProgress';

export function Library({ sets, cards, onImport, onCreate, onOpen, progress, now }: { sets: StudySet[]; cards: Flashcard[]; onImport: () => void; onCreate: () => void; onOpen: (id: string) => void; progress: CardProgress[]; now: number }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const filtered = sets.filter(set => `${set.title} ${set.description ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : b.updatedAt - a.updatedAt);
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card.setId, (counts.get(card.setId) ?? 0) + 1);
  return <>
    <div className="page-heading"><div><span className="eyebrow">A LITTLE EVERY DAY</span><h1>Your library</h1><p className="muted">Make room for what you want to remember.</p></div><button className="button secondary desktop-create" onClick={onCreate}><PlusIcon />Create set</button></div>
    <section className="welcome-panel">
      <div><span className="pill">YOUR WORDS. YOUR PACE.</span><h2>Big ideas.<br />Small flashcards.</h2><p>Bring your notes along.<br />Build a library that goes wherever you do.</p><button className="button cream" onClick={onImport}><Upload size={18} />Import files<ArrowUpRight size={18} /></button></div>
      <div className="card-illustration" aria-hidden="true"><div className="illustrated-card back-card"><span>एक कदम</span></div><div className="illustrated-card front-card"><span className="illustration-label">A LITTLE REMINDER</span><span>One step<br />at a time.</span><div className="illustration-footer"><span>✧</span><span>RECALL</span></div></div></div>
    </section>
    <div className="library-stats"><div><Layers3 size={20} /><strong>{sets.length}</strong><span>study {sets.length === 1 ? 'set' : 'sets'}</span></div><div><BookOpen size={20} /><strong>{cards.length}</strong><span>flashcards</span></div><span className="local-note"><span className="status-dot" />Stored on this device</span></div>
    <section aria-labelledby="sets-heading"><div className="section-heading"><h2 id="sets-heading">Study sets <span className="count-badge">{sets.length}</span></h2><button className="text-button mobile-create" onClick={onCreate}><PlusIcon />Create set</button></div>
      <div className="library-tools"><div className="search-field"><Search size={18} /><input aria-label="Search study sets" placeholder="Find a study set…" value={query} onChange={event => setQuery(event.target.value)} /></div><select aria-label="Sort study sets" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recently updated</option><option value="title">Title A–Z</option></select></div>
      {filtered.length ? <div className="set-grid">{filtered.map((set, index) => <button className="set-tile" key={set.id} onClick={() => onOpen(set.id)}><div className="row-between"><span className={`set-icon tone-${index % 3}`}><Layers3 size={23} /></span><ArrowUpRight size={20} className="muted" /></div><h3>{set.title}</h3><p className="muted set-description">{set.description || (set.sourceFilename ? `Imported from ${set.sourceFilename}` : 'Made by you')}</p><div className="tile-footer"><span>{counts.get(set.id) ?? 0} cards</span><span className="offline-badge"><span className="status-dot" />Local</span></div><SetProgress cards={cards.filter(card => card.setId === set.id)} progress={progress} now={now} /><p className="tile-date">Updated {new Date(set.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p></button>)}</div> : <div className="empty-state"><div className="empty-icon"><FilePlus2 size={28} /></div><h3>{query ? 'No matching study sets' : 'Your next discovery starts here'}</h3><p className="muted">{query ? 'Try another title or description.' : 'Import a .txt file or write your first few flashcards.'}</p>{!query && <button className="text-button" onClick={onCreate}>Create your first set<ArrowUpRight size={17} /></button>}</div>}
    </section>
    <aside className="library-tip"><span className="tip-symbol">✦</span><div><strong>A library that’s yours</strong><p>Your files stay on your device. No account, no uploads, no distractions.</p></div></aside>
  </>;
}
function PlusIcon() { return <span className="plus-icon" aria-hidden="true">+</span>; }
