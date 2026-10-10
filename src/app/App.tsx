import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { BarChart3, BookOpen, ChevronRight, LibraryBig, Settings2, ShieldCheck, Upload, WifiOff, X } from 'lucide-react';
import { db, deleteSet } from '../db/database';
import { Library } from '../features/library/Library';
import { SetDetail } from '../features/library/SetDetail';
import { SetEditor } from '../features/library/SetEditor';
import { ImportWizard } from '../features/import/ImportWizard';
import { Dialog } from '../components/Dialog';
import { Study } from '../features/study/Study';
import { BackupPanel } from '../features/backup/BackupPanel';
import { Progress } from '../features/progress/Progress';

type Page = 'library' | 'study' | 'progress' | 'settings';
const navigation = [{ id: 'library', label: 'Library', icon: LibraryBig }, { id: 'study', label: 'Study', icon: BookOpen }, { id: 'progress', label: 'Progress', icon: BarChart3 }, { id: 'settings', label: 'Settings', icon: Settings2 }] as const;
function route() { const hash = window.location.hash.slice(1); return hash.startsWith('study/') ? { page: 'study' as Page, setId: hash.split('/')[1] } : hash.startsWith('set/') ? { page: 'library' as Page, setId: hash.slice(4) } : { page: (['study', 'progress', 'settings'].includes(hash) ? hash : 'library') as Page, setId: undefined }; }

export function App() {
  const [location, setLocation] = useState(route);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const refresh = () => setNow(Date.now()); const timer = window.setInterval(refresh, 30000); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh); return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); }; }, []);
  const [dataDialog, setDataDialog] = useState(false);
  const [importTarget, setImportTarget] = useState<string>();
  const directory = useRef<HTMLInputElement>(null);
  const [editor, setEditor] = useState<'new' | 'edit' | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dbError, setDbError] = useState('');
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [storage, setStorage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const main = useRef<HTMLElement>(null);
  const data = useLiveQuery(async () => {
    try { return { folders: await db.folders.toArray(), sets: await db.sets.toArray(), cards: await db.cards.toArray(), settings: await db.settings.toArray(), sessions: await db.sessions.toArray(), progress: await db.progress.toArray(), reviews: await db.reviews.orderBy('reviewedAt').reverse().toArray() }; }
    catch { setDbError('Your local library could not be opened. Allow website storage and reopen Recall. Existing data has not been reset.'); return undefined; }
  });
  const { offlineReady: [offlineReady], needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ onRegisterError: () => setError('Offline caching could not start. Reconnect and reload to try again. Your saved library has not been changed.') });
  useEffect(() => {
    const onHash = () => { setLocation(route()); setNotice(''); main.current?.focus(); window.scrollTo(0, 0); };
    const onOnline = () => setOnline(navigator.onLine);
    window.addEventListener('hashchange', onHash); window.addEventListener('online', onOnline); window.addEventListener('offline', onOnline);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOnline); };
  }, []);
  const theme = data?.settings.find(setting => setting.key === 'theme')?.value ?? 'system';
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const sets = data?.sets ?? [], cards = data?.cards ?? [];
  const set = sets.find(item => item.id === location.setId);
  const setCards = cards.filter(card => card.setId === set?.id).sort((a, b) => a.position - b.position);
  const navigate = (target: string) => { window.location.hash = target; };
  const openSet = (id: string) => navigate(`set/${id}`);
  const startImport = () => { setImportTarget(undefined); input.current?.click(); };
  const clearDialog = () => { setEditor(null); setFiles(null); setDeleting(false); setError(''); };
  return <div className="app-shell">
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); main.current?.focus(); }}>Skip to content</a>
    <aside className="sidebar"><a className="brand" href="#library" aria-label="Recall library"><span className="brand-mark"><LibraryBig size={23} /></span>recall<span className="brand-dot">.</span></a><p className="sidebar-caption">A space for your mind.</p>
      <nav aria-label="Main navigation">{navigation.map(item => <a key={item.id} href={`#${item.id}`} className={`nav-item ${location.page === item.id ? 'active' : ''}`} aria-current={location.page === item.id ? 'page' : undefined}><item.icon size={21} /><span>{item.label}</span>{location.page === item.id && <span className="nav-dot" />}</a>)}</nav>
      <div className="sidebar-bottom"><ShieldCheck size={22} /><strong>Private by nature.</strong><p>Your learning lives<br />on your device.</p><span className="version">MILESTONE 04</span></div>
    </aside>
    <div className="main-column"><header className="topbar"><a className="brand mobile-brand" href="#library"><span className="brand-mark"><LibraryBig size={20} /></span>recall.</a><span className="breadcrumb">Your space <ChevronRight size={14} />{set ? 'Study set' : navigation.find(item => item.id === location.page)?.label}</span><span className="connection"><span className={`status-dot ${!online ? 'offline-dot' : ''}`} />{!online ? 'You’re offline' : offlineReady ? 'Ready offline' : 'On this device'}</span></header>
      <main id="main-content" tabIndex={-1} ref={main}>
        {!online && <p className="notice"><WifiOff size={18} />You’re offline. Your saved library is still here.</p>}
        {notice && <div className="notice" role="status"><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={18} /></button></div>}
        {error && !deleting && <p className="error" role="alert">{error}</p>}
        {dbError ? <div role="alert" className="empty-state"><h1>Storage is unavailable</h1><p>{dbError}</p><button className="button secondary" onClick={() => window.location.reload()}>Try again</button></div> : !data ? <p role="status">Opening your library…</p> : <>
          {location.page === 'library' && (location.setId ? set ? <SetDetail folders={data.folders} onReimport={() => { setImportTarget(set.id); input.current?.click(); }} key={set.id} set={set} cards={setCards} progress={data.progress} now={now} onBack={() => navigate('library')} onEdit={() => setEditor('edit')} onDelete={() => { setError(''); setDeleting(true); }} /> : <div className="empty-state"><h1>Set not found</h1><p className="muted">It may have been removed from this device.</p><button className="button primary" onClick={() => navigate('library')}>Back to library</button></div> : <Library folders={data.folders} onDialogChange={setDataDialog} sets={sets} cards={cards} progress={data.progress} now={now} onImport={startImport} onCreate={() => setEditor('new')} onOpen={openSet} />)}
          {location.page === 'study' && <Study key={`${location.setId ?? 'hub'}-${window.location.hash.endsWith('/review')}`} progress={data.progress} now={now} reviewOnly={window.location.hash.endsWith('/review')} sets={sets} cards={cards} sessions={data.sessions} settings={data.settings} setId={location.setId} />}
          {location.page === 'progress' && <Progress sets={sets} cards={cards} sessions={data.sessions} progress={data.progress} reviews={data.reviews} now={now} />}
          {location.page === 'settings' && <><div className="page-heading"><div><span className="eyebrow">MAKE YOURSELF AT HOME</span><h1>Settings</h1><p className="muted">A few things to keep your library feeling yours.</p></div></div><section className="settings-panel"><h2>Appearance</h2><label>Theme<select value={theme} onChange={async event => { try { await db.settings.put({ key: 'theme', value: event.target.value }); } catch { setError('Could not save this preference. Please try again.'); } }}><option value="system">Match device</option><option value="light">Light</option><option value="dark">Dark</option></select></label></section>
            <section className="settings-panel"><h2>Your device, your data</h2><p>Imported flashcards stay in this browser’s IndexedDB. There are no accounts, uploads, trackers, or automatic sync between devices.</p><p className="warning">Local data can be lost if website data is cleared, storage is evicted, or the app is removed. Export a library backup regularly and keep it outside this browser.</p><button className="button secondary" onClick={async () => { try { const granted = await navigator.storage?.persist?.(); setStorage(granted ? 'Persistent storage was granted. Keep copies of your source files anyway.' : 'Persistent storage is not available or was not granted. Your library still saves locally; keep your source files.'); } catch { setStorage('This browser could not grant persistent storage. Keep your source files.'); } }}>Request persistent storage</button>{storage && <p role="status" className="muted">{storage}</p>}</section>
            <BackupPanel onDialogChange={setDataDialog} />
            <section className="settings-panel"><h2>Take Recall with you</h2><p>On iPhone, open this site in Safari, use Share, then Add to Home Screen. Open it online once and wait for “Ready offline” before using it without a connection.</p><p>To import from Google Drive, enable the Drive provider in the iOS Files app, then choose your .txt or .tsv files manually. Multiple selection varies by provider. Recall cannot monitor a Drive folder.</p><button className="button primary" onClick={startImport}><Upload size={18} />Import files</button><div className="desktop-folder-import"><p>On supported desktop browsers, choose a directory of TXT/TSV files. Files become separate sets; directory structure is not imported. On iPhone, use Import files.</p><button className="button secondary" onClick={() => { setImportTarget(undefined); directory.current?.click(); }}>Import desktop folder</button></div></section></>}
        </>}
      </main><footer className="page-footer">A little learning goes a long way.<span>MADE TO REMEMBER</span></footer>
    </div>
    <nav className="bottom-nav" aria-label="Mobile navigation">{navigation.map(item => <a key={item.id} href={`#${item.id}`} aria-current={location.page === item.id ? 'page' : undefined} className={location.page === item.id ? 'active' : ''}><item.icon size={21} /><span>{item.label}</span></a>)}</nav>
    <input ref={input} type="file" accept=".txt,.tsv,text/plain,text/tab-separated-values" multiple className="sr-only" tabIndex={-1} aria-label="Choose flashcard files" onChange={event => { const chosen = Array.from(event.target.files ?? []); if (chosen.length) setFiles(chosen); event.target.value = ''; }} />
    <input ref={node => { directory.current = node; node?.setAttribute('webkitdirectory', ''); }} type="file" multiple className="sr-only" tabIndex={-1} aria-label="Choose desktop folder" onChange={event => { const chosen = Array.from(event.target.files ?? []).filter(file => /\.(txt|tsv)$/i.test(file.name)); if (chosen.length) setFiles(chosen); else setError('No TXT or TSV files found in this folder. Use Import files to select supported files.'); event.target.value = ''; }} />
    {editor && <SetEditor set={editor === 'edit' ? set : undefined} cards={editor === 'edit' ? setCards : undefined} onClose={clearDialog} onSaved={id => { clearDialog(); openSet(id); setTimeout(() => setNotice('Study set saved on this device.'), 50); }} />}
    {files && <ImportWizard cards={cards} targetId={importTarget} files={files} sets={sets} onClose={clearDialog} onSaved={(ids, count) => { clearDialog(); openSet(ids[0]); setTimeout(() => setNotice(`Imported ${count} cards in ${ids.length} study ${ids.length === 1 ? 'set' : 'sets'}. Saved on this device.`), 50); }} />}
    {deleting && set && <Dialog title="Delete this study set?" onClose={clearDialog} busy={busy}><p>“{set.title}” and its {setCards.length} cards, review progress, and study history will be permanently removed from this device. This cannot be undone.</p>{error && <p role="alert" className="error">{error}</p>}<div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={clearDialog}>Keep set</button><button className="button danger" disabled={busy} onClick={async () => { setBusy(true); try { await deleteSet(set.id); clearDialog(); navigate('library'); } catch { setError('Could not delete this set. Please try again.'); } finally { setBusy(false); } }}>{busy ? 'Deleting…' : 'Delete permanently'}</button></div></Dialog>}
    {needRefresh && !editor && !files && !deleting && !dataDialog && location.page !== 'study' && <div className="update-banner" role="status"><span>A new version of Recall is ready.</span><button className="button primary" onClick={() => void updateServiceWorker(true)}>Update app</button></div>}
  </div>;
}
