import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@clerk/react';
import { AlertCircle, ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Cloud, FolderOpen, LogOut, Plus, RotateCcw, Settings, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  getListStudySetsQueryKey, useDeleteStudySet, useGenerateStudyMaterials, useListStudySets, useUpsertStudySet,
  type StudyGeneration, type StudySetInput,
} from '@workspace/api-client-react';
import { sanitizeStudyText, type StudyMode, type StudySet } from '@/study';
import { BrandLockup, RosetteCorners, ThemeSwitcher, basePath } from '@/components/Brand';
import { ALL_MODES, MODE_INFO, ModeDialog, intIn, modeLabel } from '@/components/ModePicker';
import { JaguarRunner } from '@/components/JaguarRunner';
import { ExamSchedule } from '@/components/ExamSchedule';
import { ProfileHeader } from '@/components/ProfileMedia';
import { useProfileMedia } from '@/lib/profile-media';
import { SourceUploader, combineSources, MAX_SOURCE_CHARS, type SourceEntry } from '@/components/SourceUploader';
import { StudyOutput, setModes, type OutputTab } from '@/components/StudyOutput';
import { deleteSources, loadSources, saveSources, sourceKey, type StoredSource } from '@/lib/source-store';
import { readMigrationPreference } from '@/lib/migration-preference';

const STORAGE_KEY = 'jaguar-study-sets-v1';

function clean(value: string) {
  const c = sanitizeStudyText(value ?? '');
  if (c.text) return c.text;
  return c.removedOfficeMarkup ? 'Unreadable document formatting was removed.' : value;
}
function safeReadSets(userId?: string): StudySet[] {
  try { const p: unknown = JSON.parse(localStorage.getItem(userId ? `${STORAGE_KEY}-${userId}` : STORAGE_KEY) ?? '[]'); return Array.isArray(p) ? (p as StudySet[]) : []; } catch { return []; }
}
function toInput(set: StudySet): StudySetInput {
  return {
    title: set.title.slice(0, 160) || 'Study set', sourceName: set.sourceName.slice(0, 160) || 'Notes', sourceText: set.sourceText, summary: set.summary.slice(0, 60000),
    keyTerms: set.keyTerms, cramPoints: set.cramPoints, questions: set.questions, studyPlan: set.studyPlan, masteredTerms: set.masteredTerms ?? [],
    ...(set.theoryQuestions ? { theoryQuestions: set.theoryQuestions } : {}),
    ...(set.modes ? { modes: set.modes } : {}),
    ...(set.examMinutes ? { examMinutes: set.examMinutes } : {}),
    ...(set.tutorLesson ? { tutorLesson: set.tutorLesson.slice(0, 60000) } : {}),
  };
}
function sourceLabel(files: SourceEntry[]) {
  const names = files.filter((f) => f.status === 'ready').map((f) => f.file.name);
  const label = names.length > 2 ? `${names[0]}, ${names[1]} +${names.length - 2} more` : names.join(', ');
  return (label || 'Notes').slice(0, 160);
}
const modesKey = (userId: string) => `jaguar-modes-${userId}`;
function readModes(userId: string): StudyMode[] {
  try { const p: unknown = JSON.parse(localStorage.getItem(modesKey(userId)) ?? 'null'); if (Array.isArray(p)) { const v = ALL_MODES.filter((m) => p.includes(m)); if (v.length) return v; } } catch { /* ignore */ }
  return [...ALL_MODES];
}
const MODE_TAB: Record<StudyMode, OutputTab> = { timed: 'timed', tutor: 'tutor', summary: 'summary', objective: 'objective', cram: 'cram', theory: 'theory' };
function friendlyError(cause: unknown) {
  const msg = cause instanceof Error ? cause.message : '';
  if (/^429\b/.test(msg)) return 'Too many generation requests. Wait before retrying; if this continues, the app owner should check the service quota. Your files are retained.';
  return msg || 'Generation failed. Your notes and files are still here. Try again.';
}

export default function Workspace() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const userId = user?.id ?? '';
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const accountQueryKey = [...getListStudySetsQueryKey(), userId];
  const qc = useQueryClient();
  const generate = useGenerateStudyMaterials();
  const upsert = useUpsertStudySet();
  const removeRemote = useDeleteStudySet();
  const remoteQuery = useListStudySets({ query: { enabled: !!userId, queryKey: accountQueryKey, staleTime: 0, refetchInterval: 15000, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always' } });
  const remoteSets = useMemo(() => (remoteQuery.data ?? []) as StudySet[], [remoteQuery.data]);

  const [files, setFiles] = useState<SourceEntry[]>([]);
  const [modes, setModesRaw] = useState<StudyMode[]>([...ALL_MODES]);
  const [modeDialog, setModeDialog] = useState(false);
  const [questionCount, setQuestionCount] = useState('50');
  const [examMinutes, setExamMinutes] = useState('120');
  const avatar = useProfileMedia(userId, 'avatar');
  const [settingsOpen, setSettingsOpen] = useState(window.location.hash === '#settings');
  useEffect(() => {
    const update = () => setSettingsOpen(window.location.hash === '#settings');
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const banner = useProfileMedia(userId, 'banner');
  const readyCount = useRef(0);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);
  const [localSets, setLocalSets] = useState<StudySet[]>([]);
  const [legacySets, setLegacySets] = useState<StudySet[]>([]);
  const [migration, setMigration] = useState<'pending' | 'sync' | 'local' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [active, setActive] = useState<StudySet | null>(null);
  const [activeSources, setActiveSources] = useState<StoredSource[] | null>(null);
  const [notice, setNotice] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'builder' | 'study'>('builder');
  const [pendingModes, setPendingModes] = useState<StudyMode[]>([]);
  const [studyError, setStudyError] = useState('');
  const [studyTab, setStudyTab] = useState<OutputTab | undefined>(undefined);
  const submitting = useRef(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const refresh = () => { setLocalSets(safeReadSets(userId)); setLegacySets(safeReadSets()); };
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [userId]);
  const setModesState = (m: StudyMode[]) => { setModesRaw(m); if (userId) { try { localStorage.setItem(modesKey(userId), JSON.stringify(m)); } catch { /* ignore */ } } };
  // Prompt for modes each time a newly uploaded file finishes reading.
  useEffect(() => {
    const n = files.filter((f) => f.status === 'ready').length;
    if (n > readyCount.current) setModeDialog(true);
    readyCount.current = n;
  }, [files]);
  useEffect(() => {
    const onStorageError = (event: Event) => setError((event as CustomEvent<string>).detail);
    window.addEventListener('jaguar-storage-error', onStorageError);
    return () => window.removeEventListener('jaguar-storage-error', onStorageError);
  }, []);
  // Clear all user-specific working state whenever the signed-in user changes.
  useEffect(() => {
    setActive(null); setActiveSources(null); setFiles([]); setView('builder'); setStudyError(''); setError(''); setTried(false);
    setModesRaw(userId ? readModes(userId) : [...ALL_MODES]); readyCount.current = 0;
    if (!userId) { setMigration(null); return; }
    const stored = readMigrationPreference(`jaguar-study-migration-${userId}`, (key) => localStorage.getItem(key));
    setMigration(stored.preference);
    if (!stored.available) {
      setError('Browser storage is unavailable. Account sets can still load, but new work cannot be backed up on this device. Allow site storage before starting an exam.');
    }
  }, [userId]);
  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(''), 2800); return () => window.clearTimeout(t); }, [notice]);
  useEffect(() => {
    if (!active || !userId) return;
    let alive = true;
    setActiveSources(null);
    loadSources(sourceKey(userId, active.id)).then((s) => { if (alive) setActiveSources(s); });
    return () => { alive = false; };
  }, [active?.id, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const remoteIds = new Set(remoteSets.map((s) => s.id));
  const savedSets = [...remoteSets, ...localSets.filter((l) => !remoteIds.has(l.id))];
  const localOnly = [...localSets, ...legacySets.filter((s) => !localSets.some((l) => l.id === s.id))].filter((s) => !remoteIds.has(s.id));

  const persist = (sets: StudySet[]) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(sets));
      setLocalSets(sets);
      return true;
    } catch { setError('This browser could not save the set locally. Free some storage and try again.'); return false; }
  };
  const putRemote = (saved: StudySet) => qc.setQueryData<StudySet[]>(accountQueryKey, (old) => [saved, ...(old ?? []).filter((s) => s.id !== saved.id)]);
  const removeBackup = (id: string) => {
    persist(safeReadSets(userId).filter((s) => s.id !== id));
    const legacy = safeReadSets().filter((s) => s.id !== id);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy)); setLegacySets(legacy); } catch { /* Keep the original backup on failure. */ }
  };

  const count = intIn(questionCount, 1, 50) ?? (modes.includes('objective') || modes.includes('timed') ? null : 10);
  const minutes = intIn(examMinutes, 1, 180);
  const countError = tried && count === null ? 'Whole number from 1 to 50.' : '';
  const minutesError = tried && modes.includes('timed') && minutes === null ? 'Whole number from 1 to 180.' : '';
  const reading = files.some((f) => f.status === 'reading');
  const busy = generating || generate.isPending || upsert.isPending;

  const onGenerate = async () => {
    if (submitting.current || generate.isPending) return;
    setError(''); setTried(true);
    if (!modes.length) return setError('Pick at least one mode.');
    if (count === null) return setError('Questions must be a whole number from 1 to 50.');
    if (modes.includes('timed') && minutes === null) return setError('Exam minutes must be a whole number from 1 to 180.');
    if (reading) return setError('Wait for your files to finish reading.');
    if (files.some((file) => file.status === 'error')) return setError('Remove or replace files that could not be read before generating. All included files must be readable.');
    const sourceText = combineSources(files);
    if (sourceText.replace(/=== Source[^\n]*===/g, '').trim().length < 120) return setError('Upload a readable file containing at least 120 characters of course material.');
    if (sourceText.length > MAX_SOURCE_CHARS) return setError(`Combined sources are over ${MAX_SOURCE_CHARS.toLocaleString()} characters. Remove a file or upload a smaller document.`);
    const sourceName = sourceLabel(files);
    submitting.current = true;
    setGenerating(true);
    setModeDialog(false); setStudyError(''); setActive(null); setPendingModes(modes); setStudyTab(undefined); setView('study');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const result: StudyGeneration = await generate.mutateAsync({
        data: {
          // hoursPerDay is a legacy required field; the personal schedule is never sent.
          sourceName, sourceText, hoursPerDay: 1, questionCount: count, modes,
          ...(modes.includes('timed') && minutes ? { examMinutes: minutes } : {}),
        },
      });
      if (!alive.current) return;
      const created: StudySet = {
        ...result, modes: result.modes ?? modes, ...(modes.includes('timed') && minutes ? { examMinutes: result.examMinutes ?? minutes } : {}),
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, sourceName, sourceText, createdAt: new Date().toISOString(), masteredTerms: [],
      };
      const originals = files.filter((f) => f.status === 'ready').map((f) => ({ name: f.file.name, type: f.file.type, blob: f.file as Blob }));
      if (userId && originals.length) await saveSources(sourceKey(userId, created.id), originals).catch(() => {
        setError('Your study materials were generated, but this browser could not save the original files. Reattach the files to preview them after reloading.');
      });
      if (!alive.current) return;
      persist([created, ...safeReadSets(userId).filter((s) => s.id !== created.id)]);
      let synced = false;
      if (userId) {
        try { const saved = await upsert.mutateAsync({ id: created.id, data: toInput(created) }); if (!alive.current) return; removeBackup(saved.id); putRemote(saved as StudySet); synced = true; }
        catch { setNotice('Saved on this browser only. Sync it when you are back online.'); }
      }
      setActive(created);
      if (synced) setNotice('Ready and synced to your account.');
    } catch (cause) {
      setStudyError(friendlyError(cause));
    } finally {
      submitting.current = false;
      setGenerating(false);
    }
  };

  const openSet = (set: StudySet) => { if (generating) return; setStudyError(''); setStudyTab(undefined); setActive(set); setView('study'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const backToBuilder = () => { setView('builder'); setStudyError(''); };
  const studyModes: StudyMode[] = generate.isPending || studyError || !active ? pendingModes : setModes(active);

  const rate = (term: string, ok: boolean) => {
    if (!active) return;
    const m = new Set(active.masteredTerms ?? []);
    if (ok) m.add(term); else m.delete(term);
    const updated = { ...active, masteredTerms: Array.from(m) };
    setActive(updated);
    if (remoteIds.has(updated.id)) upsert.mutate({ id: updated.id, data: toInput(updated) }, { onSuccess: (s) => putRemote(s as StudySet), onError: () => setNotice('Progress could not sync.') });
    else persist(localSets.map((s) => (s.id === updated.id ? updated : s)));
  };

  const deleteSet = (set: StudySet) => {
    const remote = remoteIds.has(set.id);
    if (!window.confirm(`Delete "${clean(set.title)}"${remote ? ' from your account' : ' from this browser'}? This cannot be undone.`)) return;
    const done = () => { if (active?.id === set.id) { setActive(null); setView('builder'); } if (userId) void deleteSources(sourceKey(userId, set.id)); setNotice('Study set deleted.'); };
    if (remote) removeRemote.mutate({ id: set.id }, { onSuccess: () => { qc.setQueryData<StudySet[]>(accountQueryKey, (old) => (old ?? []).filter((s) => s.id !== set.id)); removeBackup(set.id); done(); }, onError: () => setError('Could not delete. Try again.') });
    else { persist(localSets.filter((s) => s.id !== set.id)); done(); }
  };

  const syncOne = async (set: StudySet) => {
    try { const saved = await upsert.mutateAsync({ id: set.id, data: toInput(set) }); if (!alive.current) return; removeBackup(saved.id); putRemote(saved as StudySet); setNotice('Synced to your account.'); }
    catch { setNotice('Could not sync. It is still on this browser.'); }
  };
  const syncAll = async () => {
    if (!userId || syncing) return;
    setSyncing(true); let n = 0;
    try {
      for (const set of localOnly) {
        if (!alive.current) return;
        const saved = await upsert.mutateAsync({ id: set.id, data: toInput(set) });
        if (!alive.current) return;
        putRemote(saved as StudySet); removeBackup(saved.id); n += 1;
      }
      localStorage.setItem(`jaguar-study-migration-${userId}`, 'sync'); setMigration('sync');
      setNotice(n ? `${n} ${n === 1 ? 'set' : 'sets'} synced.` : 'Already up to date.');
    } catch { setNotice(`Synced ${n} of ${localOnly.length}. The rest are safe here; retry anytime.`); }
    finally { setSyncing(false); }
  };
  const keepLocal = () => {
    if (!userId || !persist(localOnly)) return;
    try {
      localStorage.removeItem(STORAGE_KEY); setLegacySets([]);
      localStorage.setItem(`jaguar-study-migration-${userId}`, 'local'); setMigration('local');
    } catch { setError('Could not update the import preference. Your sets are retained.'); }
  };

  const reattach = async (picked: File[]) => {
    if (!active || !userId) return;
    const ok = picked.filter((f) => /\.(pdf|pptx)$/i.test(f.name) && f.size <= 15 * 1024 * 1024);
    if (!ok.length) return setNotice('Choose a PDF or PPTX up to 15 MB.');
    const merged = [...(activeSources ?? []), ...ok.map((f) => ({ name: f.name, type: f.type, blob: f as Blob }))];
    try {
      await saveSources(sourceKey(userId, active.id), merged);
    } catch {
      setError('This browser could not save the source files. Free storage space and try again.');
      return;
    }
    setActiveSources(merged);
    setNotice('Source attached on this device.');
  };

  const modeLinks = (where: 'side' | 'mobile') => {
    const ready = !!active && !generate.isPending && !studyError;
    return MODE_INFO.filter((m) => studyModes.includes(m.id)).map(({ id, label, Icon }) => {
      const on = ready && view === 'study' && (studyTab === MODE_TAB[id] || (id === 'summary' && (studyTab === 'terms' || studyTab === 'flashcards')));
      return (
        <button key={id} type="button" className={`nav-item mode-link${on ? ' active' : ''}`} aria-disabled={!ready} aria-current={on ? 'page' : undefined}
          onClick={() => { if (!ready) return; if (settingsOpen) { setSettingsOpen(false); window.location.hash = ''; } setView('study'); setStudyTab(MODE_TAB[id]); }}
          data-testid={`${where === 'side' ? 'rail' : 'mobile'}-mode-${id}`}><Icon size={14} /> {label}</button>
      );
    });
  };

  const initial = (user?.firstName?.[0] ?? user?.emailAddresses[0]?.emailAddress[0] ?? 'J').toUpperCase();

  return (
    <div className={`app-shell${view === 'study' && !settingsOpen ? ' in-study' : ''}`}>
      <RosetteCorners />
      <aside className="sidebar" aria-label="Jaguar workspace">
        <BrandLockup size={31} />
        <nav className="side-nav" aria-label="Sections" onClick={(event) => {
          if (!settingsOpen) return;
          const target = (event.target as HTMLElement).closest('button')?.dataset.testid;
          if (!target) return;
          setSettingsOpen(false);
          window.location.hash = '';
          window.setTimeout(() => {
            if (target === 'nav-saved') document.getElementById('saved-sets')?.scrollIntoView({ behavior: 'smooth' });
            else if (target === 'nav-active') setView('study');
            else window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 0);
        }}>
          <button className={`nav-item${view === 'builder' ? ' active' : ''}`} type="button" onClick={() => { setView('builder'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} data-testid="nav-create"><Plus size={16} /> New study set</button>
          <button className="nav-item" type="button" onClick={() => { setView('builder'); window.setTimeout(() => document.getElementById('saved-sets')?.scrollIntoView({ behavior: 'smooth' }), 0); }} data-testid="nav-saved"><FolderOpen size={16} /> Saved sets <span className="nav-count">{String(savedSets.length).padStart(2, '0')}</span></button>
          {(active || generate.isPending || studyError) && <button className={`nav-item${view === 'study' ? ' active' : ''}`} type="button" onClick={() => setView('study')} data-testid="nav-active"><BookOpen size={16} /> Open set</button>}
          {(active || generate.isPending || studyError) && <div className="side-modes" role="group" aria-label="Study modes">{modeLinks('side')}</div>}
        </nav>
        <div className="sidebar-bottom"><ThemeSwitcher /></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><BrandLockup size={30} /></div>
          <div className="crumb">{settingsOpen ? 'Settings' : view === 'study' ? 'Your study set' : 'Account-connected study sets'}</div>
          <div className="top-status">
            <span className="mobile-only"><ThemeSwitcher compact /></span>
            <span className="local-pill"><span className="status-dot" /> Account sync</span>
            <button className="quiet-button" type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out" aria-label="Sign out"><LogOut size={13} /><span className="hide-sm">Sign out</span></button>
            <button className="quiet-button" type="button" onClick={() => { window.location.hash = 'settings'; window.scrollTo(0, 0); }} aria-current={settingsOpen ? 'page' : undefined} data-testid="button-settings"><Settings size={16} /> Settings</button>
          </div>
        </header>

        {settingsOpen && <div className="workspace profile-settings-page" data-testid="page-settings">
          <button className="quiet-button" type="button" onClick={() => { window.location.hash = ''; }} data-testid="button-back-study">Back to study</button>
          <h1>Settings</h1>
          <ProfileHeader initial={initial} name={user?.firstName ?? 'Your'} avatar={avatar} banner={banner} notify={setNotice}>
            <h2>Your profile</h2><p className="welcome-copy">Manage your profile picture and banner.</p>
          </ProfileHeader>
        </div>}
        <div className="workspace" hidden={settingsOpen || view !== 'study'} data-testid="page-study-view">
          <div className="study-view">
            <nav className="mobile-mode-nav" aria-label="Study modes (mobile)">
              <button className="nav-item" type="button" onClick={backToBuilder} data-testid="button-back-builder"><ArrowLeft size={14} /> Builder</button>
              {modeLinks('mobile')}
            </nav>
            <div className="study-stage" ref={outputRef}>
              {generating ? (
                <div className="panel"><JaguarRunner label={`Building ${pendingModes.length} ${pendingModes.length === 1 ? 'mode' : 'modes'} from your notes...`} /></div>
              ) : studyError ? (
                <div className="panel study-error" role="alert" data-testid="error-generation">
                  <div className="error-message"><AlertCircle size={13} /> {studyError}</div>
                  <div className="study-error-actions">
                    <button className="primary-button" type="button" onClick={() => void onGenerate()} data-testid="button-retry-generation"><RotateCcw size={13} /> Retry</button>
                    <button className="quiet-button" type="button" onClick={() => setModeDialog(true)} data-testid="button-change-selection"><SlidersHorizontal size={13} /> Change selection</button>
                    <button className="quiet-button" type="button" onClick={backToBuilder} data-testid="button-error-back"><ArrowLeft size={13} /> Back</button>
                  </div>
                </div>
              ) : active ? (
                <StudyOutput set={active} userId={userId} synced={remoteIds.has(active.id)} clean={clean} sources={activeSources} onReattach={(f) => void reattach(f)} onRate={rate} onClose={() => { setActive(null); setView('builder'); }} notify={setNotice} tab={studyTab} onTab={setStudyTab} />
              ) : (
                <div className="empty-state"><div><strong>Nothing open</strong><p>Pick a saved set or build a new one.</p></div></div>
              )}
            </div>
          </div>
        </div>
        <div className="workspace builder-workspace" hidden={settingsOpen || view !== 'builder'}>
          <section className="builder-welcome">
            <h1 id="welcome-title" data-testid="text-workspace-heading">Exam is soon ooo</h1>
            <p className="welcome-copy">Bring your note so you can study</p>
          </section>

          {(migration === 'pending' || legacySets.length > 0) && localOnly.length > 0 && (
            <section className="sync-choice reveal">
                            <div className="sync-choice-copy"><h2>Earlier sets on this browser</h2><p>{localOnly.length} local {localOnly.length === 1 ? 'set' : 'sets'} found. Only import these if they belong to you. Sync them to your account, or keep them locally for this account. Nothing is removed unless saving succeeds.</p></div>
              <div className="sync-choice-actions">
                <button className="primary-button" type="button" onClick={() => void syncAll()} disabled={syncing} data-testid="button-sync-local">{syncing ? 'Syncing...' : 'Sync to my account'}</button>
                <button className="quiet-button" type="button" onClick={keepLocal} data-testid="button-keep-local">Keep on this browser</button>
              </div>
            </section>
          )}

          <div className="builder-workbench">
          <div className="builder-create">
          <section aria-label="Create a study set" className="reveal">
            <div className="panel source-panel">
              <div className="panel-head"><h2 className="panel-title">Bring your note</h2></div>
              <SourceUploader files={files} onFiles={setFiles} disabled={busy} />
              {error && !modeDialog && <div className="error-message" role="alert" data-testid="error-builder"><AlertCircle size={13} /> {error}</div>}
            </div>
          </section>
          <section className="builder-mode-entry">
            <h2>Next, choose how you want to study</h2>
            <button className="primary-button" type="button" onClick={() => setModeDialog(true)} disabled={busy} data-testid="button-open-modes">Choose study modes <ChevronRight size={16} /></button>
          </section>
          </div>
          <aside className="builder-aside" aria-label="Your exam and saved sets">
          <ExamSchedule userId={userId} />

          <section id="saved-sets" aria-labelledby="saved-heading">
            <div className="section-heading"><h2 id="saved-heading">Saved sets</h2>{savedSets.length > 0 && <span className="step-label">{savedSets.length} saved</span>}</div>
            {remoteQuery.isLoading ? <div className="loading-saved" role="status" aria-label="Loading"><span /><span /><span /></div>
              : remoteQuery.isError ? <div className="error-message" role="alert">Your account sets could not load. <button className="inline-retry" type="button" onClick={() => void remoteQuery.refetch()} data-testid="button-retry-study-sets">Try again</button></div>
              : savedSets.length === 0 ? <div className="empty-state" data-testid="empty-saved"><div><strong>Nothing saved yet</strong><p>Your first set will wait for you here.</p></div></div>
              : (
                <div className="saved-grid saved-rows">
                  {savedSets.map((set) => {
                    const remote = remoteIds.has(set.id);
                    return (
                      <article className={`saved-card saved-row${active?.id === set.id ? ' current' : ''}`} key={set.id} data-testid={`card-study-set-${set.id}`}>
                        <button className="saved-open" type="button" onClick={() => openSet(set)} data-testid={`button-open-${set.id}`}>
                          <h3>{clean(set.title) || 'Study set'}</h3>
                          <div className="saved-meta">{clean(set.sourceName) || 'Notes'}</div>
                          <div className="saved-meta">{new Date(set.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {setModes(set).map(modeLabel).join(', ')}{remote ? '' : ' · This browser only'}</div>
                        </button>
                        <div className="saved-actions">
                          {!remote && <button className="icon-button" type="button" onClick={() => void syncOne(set)} disabled={upsert.isPending} aria-label="Sync to account" data-testid={`button-sync-${set.id}`}><Cloud size={13} /></button>}
                          <button className="icon-button danger" type="button" onClick={() => deleteSet(set)} aria-label={`Delete ${clean(set.title)}`} data-testid={`button-delete-${set.id}`}><Trash2 size={13} /></button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
          </section>
          </aside>
          </div>
        </div>
      </main>
      <ModeDialog open={modeDialog} modes={modes} onModes={setModesState} onClose={() => setModeDialog(false)} onGenerate={() => void onGenerate()} busy={generating} error={error}
        questionCount={questionCount} onQuestionCount={setQuestionCount} examMinutes={examMinutes} onExamMinutes={setExamMinutes} countError={countError} minutesError={minutesError} />
      {notice && <div className="toast-message" role="status" data-testid="status-toast"><CheckCircle2 size={15} /> {notice}</div>}
    </div>
  );
}
