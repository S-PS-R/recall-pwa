import { useState } from 'react';
import { ArrowLeft, Check, Pencil, Trash2 } from 'lucide-react';
import type { CardProgress, Flashcard, StudySet } from '../../domain/types';
import { SetProgress } from '../progress/SetProgress';

export function SetDetail({ set, cards, onBack, onEdit, onDelete, progress, now }: { set: StudySet; cards: Flashcard[]; onBack: () => void; onEdit: () => void; onDelete: () => void; progress: CardProgress[]; now: number }) {
  const [limit, setLimit] = useState(50);
  return <>
    <button className="text-button back-link" onClick={onBack}><ArrowLeft size={17} />Library</button>
    <div className="page-heading detail-heading"><div><span className="eyebrow">STUDY SET · {cards.length} CARDS</span><h1>{set.title}</h1><p className="muted">{set.description || 'A little more knowledge, right here.'}</p></div><div className="flex gap-2"><button className="button secondary" onClick={onEdit}><Pencil size={17} />Edit set</button><button className="icon-button danger-text" aria-label="Delete study set" onClick={onDelete}><Trash2 size={20} /></button></div></div>
    <div className="notice local-notice"><Check size={19} /><div><strong>Saved on this device</strong><p>{set.sourceFilename ? `Source: ${set.sourceFilename}. ` : ''}These flashcards are stored locally and available without a connection once the app is cached.</p></div></div>
    <a className="button primary" href={`#study/${set.id}`}>Study this set</a>
    <SetProgress cards={cards} progress={progress} now={now} />
    <div className="section-heading"><h2>Your flashcards</h2><span className="muted text-sm">Original order</span></div>
    <div className="detail-card-list"><div className="detail-card-labels"><span>#</span><span>TERM</span><span>DEFINITION</span></div>{cards.slice(0, limit).map((card, index) => <article className="detail-card" key={card.id}><span className="card-number">{index + 1}</span><p>{card.front}</p><p>{card.back}</p></article>)}</div>
    {cards.length > limit && <button className="button secondary mt-4" onClick={() => setLimit(limit + 50)}>Show more cards ({cards.length - limit} remaining)</button>}
    <p className="milestone-note">Try Flashcards, Learn, or Test. Study sessions save locally so you can pick up later.</p>
  </>;
}
