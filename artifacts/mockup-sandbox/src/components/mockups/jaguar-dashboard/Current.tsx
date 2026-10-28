import {useState} from 'react';
import {Plus,FolderOpen,BookOpen,LogOut,Settings,SlidersHorizontal,ChevronRight,AlertCircle} from 'lucide-react';
import {BrandLockup,RosetteCorners} from './_Brand';
import {SourceUploader,type SourceEntry} from './_SourceUploader';
import {ExamSchedule} from './_ExamSchedule';
import './_group.css';
function ThemeSwitcher({compact=false}:{compact?:boolean}) { return <button className="quiet-button" type="button">{compact ? 'Violet' : 'Theme · Violet'}</button>; }
export function Current(){
const [view,setView]=useState('builder'); const [settingsOpen,setSettingsOpen]=useState(false);const [files,setFiles]=useState<SourceEntry[]>([]);
const savedSets:unknown[]=[];const active=false;const generate={isPending:false};const studyError='';const modeLinks=(_where:string)=>null;
const busy=false;const error='';const modeDialog=false;const setModeDialog=(_open:boolean)=>{};const userId='design-preview';const basePath='';const signOut=async (_opts:unknown)=>{};
return (    <div className={`app-shell${view === 'study' && !settingsOpen ? ' in-study' : ''}`}>
      <RosetteCorners />
      <aside className="sidebar" aria-label="Jaguar workspace">
        <BrandLockup size={42} caption="exam prep" />
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
          <div className="crumb">WORKSPACE <span>/</span> <strong>{settingsOpen ? 'Settings' : view === 'study' ? 'Study view' : 'Study'}</strong></div>
          <div className="top-status">
            <span className="mobile-only"><ThemeSwitcher compact /></span>
            <span className="local-pill"><span className="status-dot" /> Account sync</span>
            <button className="quiet-button" type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out" aria-label="Sign out"><LogOut size={13} /><span className="hide-sm">Sign out</span></button>
            <button className="quiet-button" type="button" onClick={() => { window.location.hash = 'settings'; window.scrollTo(0, 0); }} aria-current={settingsOpen ? 'page' : undefined} data-testid="button-settings"><Settings size={16} /> Settings</button>
          </div>
        </header>

        <div className="workspace" hidden={settingsOpen || view !== 'builder'}>
          <section style={{ marginBottom: 30 }}>
            <h1 id="welcome-title" data-testid="text-workspace-heading">Exam is soon ooo</h1>
            <p className="welcome-copy">Bring your note so you can study</p>
          </section>

          <section aria-label="Create a study set" className="reveal">
            <div className="panel source-panel">
              <div className="panel-head"><h2 className="panel-title">Bring your note</h2><button className="quiet-button" type="button" onClick={() => setModeDialog(true)} data-testid="button-open-modes"><SlidersHorizontal size={13} /> Choose modes <ChevronRight size={13} /></button></div>
              <SourceUploader files={files} onFiles={setFiles} disabled={busy} />
              {error && !modeDialog && <div className="error-message" role="alert" data-testid="error-builder"><AlertCircle size={13} /> {error}</div>}
            </div>
          </section>

          <ExamSchedule userId={userId} />

<section id="saved-sets"><div className="section-heading"><h2>Saved sets</h2></div><div className="empty-state"><div><strong>Nothing saved yet</strong><p>Your first set will wait for you here.</p></div></div></section></div></main></div>);
}
