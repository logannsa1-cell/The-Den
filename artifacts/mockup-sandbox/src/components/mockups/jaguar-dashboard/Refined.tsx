import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, FileText, FolderOpen, Plus, Settings, Trash2, Upload, X } from 'lucide-react';
import './Refined.css';

const MODES = [
  { id: 'summary', title: 'Note Summary', detail: 'A clear overview of your notes' },
  { id: 'tutor', title: 'Tutor Lesson', detail: 'Work through the ideas step by step' },
  { id: 'cram', title: 'Cram Sheet', detail: 'A focused last-minute review' },
  { id: 'objective', title: 'Objective Questions', detail: 'Multiple-choice practice' },
  { id: 'theory', title: 'Theory Test', detail: 'Practice written answers' },
  { id: 'exam', title: 'Time-Based Exam', detail: 'Answer against the clock' },
];
const ACCEPTED = '.pdf,.docx,.pptx,.txt,.md,.csv';
const ALLOWED = ['pdf', 'docx', 'pptx', 'txt', 'md', 'csv'];
type LocalFile = { id: string; file: File; error?: string };

export function Refined() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [dialog, setDialog] = useState<'modes' | 'generation' | 'settings' | null>(null);
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [dailyTime, setDailyTime] = useState('1');
  const [dragging, setDragging] = useState(false);
  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const next = Array.from(incoming).map((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const error = !ALLOWED.includes(ext) ? 'Use a PDF, DOCX, PPTX, TXT, MD or CSV file.' : file.size > 15 * 1024 * 1024 ? 'This file is over 15 MB.' : undefined;
      return { id: `${file.name}-${file.lastModified}-${Math.random()}`, file, error };
    });
    setFiles((current) => [...current, ...next]);
    if (inputRef.current) inputRef.current.value = '';
  };
  const daysAway = date ? Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null;
  const toggleMode = (id: string) => setSelectedModes((current) => current.includes(id) ? current.filter((mode) => mode !== id) : [...current, id]);

  const validFiles = files.filter((item) => !item.error);
  const openSavedSets = () => document.getElementById('jr-saved-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return (
    <div className="jaguar-refined">
      <aside className="jr-sidebar" aria-label="Jaguar workspace">
        <a className="jr-brand" href="#" aria-label="Jaguar home" onClick={(event) => event.preventDefault()}>
          <img src="/__mockup/images/jaguar-mark.svg" alt="" /><span>Jaguar</span>
        </a>
        <nav className="jr-nav" aria-label="Main navigation">
          <button className="jr-nav-item is-current" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Plus size={16} />New study set</button>
          <button className="jr-nav-item" type="button" onClick={openSavedSets}><FolderOpen size={16} />Saved sets</button>
        </nav>
      </aside>

      <div className="jr-content">
      <header className="jr-topbar">
        <span className="jr-sync-label">Account-connected study sets</span>
        <button className="jr-settings" type="button" onClick={() => setDialog('settings')}><Settings size={16} /><span>Settings</span></button>
      </header>
      <main className="jr-main">
        <section className="jr-welcome" aria-labelledby="jr-title">
          <h1 id="jr-title">Exam is soon ooo</h1>
          <p className="jr-intro">Bring your note so you can study</p>
        </section>

        <div className="jr-workbench">
          <div className="jr-create">
            <section className="jr-upload-section" aria-labelledby="jr-upload-title">
              <div className="jr-section-top">
                <div>
                  <h2 id="jr-upload-title">Bring your note</h2>
                </div>
              </div>
              <div className={`jr-dropzone${dragging ? ' is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
                <div className="jr-upload-mark"><Upload size={19} strokeWidth={1.8} /></div>
                <div className="jr-drop-copy">
                  <strong>Drop a course file here</strong>
                  <span>PDF, DOCX, PPTX, TXT, MD or CSV · up to 15 MB each</span>
                </div>
                <button className="jr-outline-button" type="button" onClick={() => inputRef.current?.click()}><Plus size={15} /> Choose file</button>
                <input ref={inputRef} className="jr-visually-hidden" type="file" multiple accept={ACCEPTED} aria-label="Choose course files" onChange={(event) => addFiles(event.target.files)} />
              </div>
              {files.length > 0 && <ul className="jr-files" aria-label="Selected files">
                {files.map(({ id, file, error }) => <li key={id} className={`jr-file${error ? ' has-error' : ''}`}>
                  <FileText size={16} />
                  <span><strong>{file.name}</strong><small>{error ?? `${(file.size / 1024).toFixed(0)} KB · selected on this device`}</small></span>
                  <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item.id !== id))}><X size={15} /></button>
                </li>)}
              </ul>}
              <p className="jr-privacy">Files are selected for this preview; they are not uploaded from this canvas.</p>
            </section>

            <section className="jr-mode-entry">
              <div className="jr-section-top">
                <div><h2>Next, choose how you want to study</h2></div>
              </div>
              <button className="jr-generate" type="button" disabled={!validFiles.length} onClick={() => setDialog('modes')}>
                <span>{selectedModes.length ? 'Review study modes' : 'Choose study modes'}</span><ArrowRight size={17} />
              </button>
              <p className="jr-preview-note">Study-set generation is a preview in this canvas.</p>
            </section>
          </div>

          <aside className="jr-aside">
            <section className="jr-schedule" aria-labelledby="jr-schedule-title">
              <div className="jr-aside-heading">
                <span className="jr-aside-icon"><CalendarDays size={17} /></span>
                <div><p className="jr-kicker">Keep it in view</p><h2 id="jr-schedule-title">Your exam</h2></div>
              </div>
              {date && <div className="jr-countdown" aria-live="polite">
                <strong>{daysAway !== null && daysAway < 0 ? 'Passed' : daysAway}</strong>
                <span>{daysAway !== null && daysAway < 0 ? 'Your exam date has passed' : `${daysAway === 1 ? 'day' : 'days'}${subject ? ` until ${subject}` : ' to go'}`}</span>
              </div>}
              <label className="jr-field"><span>Subject</span><input value={subject} maxLength={60} placeholder="e.g. Biology paper 2" onChange={(event) => setSubject(event.target.value)} /></label>
              <div className="jr-schedule-row">
                <label className="jr-field"><span>Exam date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                <label className="jr-field"><span>Daily time</span><span className="jr-select-wrap"><select value={dailyTime} onChange={(event) => setDailyTime(event.target.value)}><option value="0.5">30 min</option><option value="1">1 hour</option><option value="1.5">1.5 hours</option><option value="2">2 hours</option><option value="3">3 hours</option><option value="4">4 hours</option></select><ChevronDown size={13} /></span></label>
              </div>
              {(date || subject) && <button className="jr-clear-schedule" type="button" onClick={() => { setSubject(''); setDate(''); }}><Trash2 size={13} /> Clear schedule</button>}
              <p className="jr-schedule-foot">Just for you. This schedule is separate from making a study set.</p>
            </section>

            <section className="jr-saved" id="jr-saved" aria-labelledby="jr-saved-title">
              <div className="jr-saved-heading"><h2 id="jr-saved-title">Saved sets</h2><FolderOpen size={17} /></div>
              <p>No sets saved yet.</p>
              <span>Your study sets will have a place here.</span>
            </section>
          </aside>
        </div>
      </main>
      </div>

      {dialog && <div className="jr-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
        <section className="jr-dialog" role="dialog" aria-modal="true" aria-labelledby="jr-dialog-title">
          <button className="jr-dialog-close" type="button" onClick={() => setDialog(null)} aria-label="Close preview"><X size={17} /></button>
          {dialog === 'modes' ? <>
            <span className="jr-dialog-mark"><BookOpen size={18} /></span>
            <p className="jr-kicker">For this set</p>
            <h2 id="jr-dialog-title">Choose your study modes</h2>
            <p>Select what would be useful from the notes you brought.</p>
            <fieldset className="jr-mode-list jr-dialog-modes">
              <legend className="jr-visually-hidden">Study modes</legend>
              {MODES.map((mode) => {
                const active = selectedModes.includes(mode.id);
                return <label key={mode.id} className={`jr-mode${active ? ' is-selected' : ''}`}>
                  <input type="checkbox" checked={active} onChange={() => toggleMode(mode.id)} />
                  <span className="jr-check" aria-hidden="true">{active && <Check size={13} />}</span>
                  <span className="jr-mode-name"><strong>{mode.title}</strong><small>{mode.detail}</small></span>
                </label>;
              })}
            </fieldset>
            <button className="jr-generate" type="button" disabled={!selectedModes.length} onClick={() => setDialog('generation')}><span>Make a study set</span><ArrowRight size={17} /></button>
            <p className="jr-preview-note">Generation is a preview here. Nothing is sent or created.</p>
          </> : dialog === 'generation' ? <>
            <p className="jr-kicker">Preview only</p>
            <h2 id="jr-dialog-title">Your study set starts with your notes.</h2>
            <p>This mockup does not generate or save study material. In Jaguar, this is where your selected file and {selectedModes.length} {selectedModes.length === 1 ? 'mode' : 'modes'} would come together.</p>
            <button className="jr-dialog-action" type="button" onClick={() => setDialog(null)}>Back to my notes</button>
          </> : <>
            <span className="jr-dialog-mark"><Settings size={18} /></span>
            <p className="jr-kicker">Settings preview</p>
            <h2 id="jr-dialog-title">A few things, kept simple.</h2>
            <p>Settings are shown as a preview here. Account and theme changes are not available in this canvas.</p>
            <div className="jr-setting-row"><span>Appearance</span><strong>Violet <span className="jr-violet-swatch" /></strong></div>
            <div className="jr-setting-row"><span>Study files</span><strong>On this device</strong></div>
            <button className="jr-dialog-action" type="button" onClick={() => setDialog(null)}>Done</button>
          </>}
        </section>
      </div>}
    </div>
  );
}

export default Refined;
