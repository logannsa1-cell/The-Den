import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  AlertCircle, ArrowDownToLine, BookOpen, Bookmark, CheckCircle2, ChevronRight,
  CircleHelp, Clock3, Copy, FileText, Flame, FolderOpen, KeyRound,
  Layers, Lightbulb, ListChecks, LoaderCircle, LockKeyhole, PawPrint, Plus, RotateCcw,
  Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import { useGenerateStudyMaterials, type StudyGeneration } from '@workspace/api-client-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { readStudyFile, sanitizeStudyText, type StudySet } from './study';

const queryClient = new QueryClient();
const STORAGE_KEY = 'jaguar-study-sets-v1';
const ACCEPTED = '.pdf,.docx,.pptx,.txt,.md,.csv';
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_SOURCE_CHARS = 60000;
type OutputTab = 'summary' | 'terms' | 'flashcards' | 'practice' | 'cram' | 'plan';

function displayText(value: string, fallback = 'Unreadable document formatting was removed. Re-upload the original file to rebuild this section.') {
  const cleaned = sanitizeStudyText(value);
  if (cleaned.text) return cleaned.text;
  return cleaned.removedOfficeMarkup ? fallback : value;
}

const today = new Date();
today.setDate(today.getDate() + 7);
const defaultExamDate = today.toISOString().slice(0, 10);

function safeReadSets(): StudySet[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed as StudySet[] : [];
  } catch {
    return [];
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function outputText(set: StudySet, tab: OutputTab): string {
  if (tab === 'summary') return displayText(set.summary);
  if (tab === 'terms' || tab === 'flashcards') return set.keyTerms.map(({ term, definition }) => `${displayText(term)}\n${displayText(definition)}`).join('\n\n');
  if (tab === 'cram') return set.cramPoints.map((point) => `• ${displayText(point)}`).join('\n');
  if (tab === 'plan') return set.studyPlan.map((day) => `${day.date} — ${displayText(day.focus)}\n${day.tasks.map((task) => `- ${displayText(task)}`).join('\n')}`).join('\n\n');
  return set.questions.map((question, index) => `${index + 1}. ${displayText(question.prompt)}\n${question.choices.map((choice, choiceIndex) => `${String.fromCharCode(65 + choiceIndex)}. ${displayText(choice)}`).join('\n')}\nAnswer: ${displayText(question.choices[question.answerIndex])}\n${displayText(question.explanation)}`).join('\n\n');
}

function toStoredSet(result: StudyGeneration, sourceName: string, sourceText: string): StudySet {
  return {
    ...result,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sourceName,
    sourceText,
    createdAt: new Date().toISOString(),
    masteredTerms: [],
  };
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function Home() {
  const generate = useGenerateStudyMaterials();
  const [notes, setNotes] = useState('');
  const [sourceName, setSourceName] = useState('Pasted notes');
  const [examDate, setExamDate] = useState(defaultExamDate);
  const [hoursPerDay, setHoursPerDay] = useState('1');
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [savedSets, setSavedSets] = useState<StudySet[]>([]);
  const [activeSet, setActiveSet] = useState<StudySet | null>(null);
  const [activeTab, setActiveTab] = useState<OutputTab>('summary');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLElement>(null);
  const isPending = generate.isPending || isReading;

  useEffect(() => {
    setSavedSets(safeReadSets());
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const persist = (sets: StudySet[]) => {
    setSavedSets(sets);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
    } catch {
      setError('This browser could not save the set. Try clearing local storage space and generating again.');
    }
  };

  const takeFile = async (file?: File) => {
    if (!file) return;
    setFileError('');
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'pptx', 'txt', 'md', 'csv'].includes(ext ?? '')) {
      setFileError('That format is not supported. Choose PDF, DOCX, PPTX, TXT, MD, or CSV.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('This file is larger than 15 MB. Try a smaller file or paste a section of your notes.');
      return;
    }
    setIsReading(true);
    try {
      const extractedText = await readStudyFile(file);
      const cleaned = sanitizeStudyText(extractedText);
      const text = cleaned.text;
      if (cleaned.removedOfficeMarkup) {
        setNotice('Removed Office formatting and kept readable text.');
      }
      if (text.trim().length < 30) {
        throw new Error(
          cleaned.removedOfficeMarkup
            ? 'This file contained Office formatting but no readable slide text. Try exporting it as a searchable PDF or paste the text.'
            : 'We could not find enough readable text. Scanned PDFs and image-only slides are not supported yet.',
        );
      }
      if (text.length > MAX_SOURCE_CHARS) {
        throw new Error('This file contains more than 60,000 characters. Try a smaller chapter or paste one section at a time.');
      }
      setNotes(text);
      setSourceName(file.name);
      setNotice('Text extracted in this browser. Your file itself stays here.');
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : 'We could not read this file. Try another format or paste the text.');
    } finally {
      setIsReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const onGenerate = async () => {
    setError('');
    const cleaned = sanitizeStudyText(notes);
    const sourceText = cleaned.text.trim();
    if (cleaned.removedOfficeMarkup) {
      setNotes(sourceText);
      setNotice('Removed Office formatting markup from your notes.');
    }
    if (sourceText.length < 120) {
      setError('Add at least 120 characters of course material to build a useful study set.');
      return;
    }
    if (sourceText.length > MAX_SOURCE_CHARS) {
      setError('Keep your source material under 60,000 characters. Try one chapter or section at a time.');
      return;
    }
    try {
      const result = await generate.mutateAsync({
        data: {
          sourceName: sourceName || 'Pasted notes',
          sourceText,
          ...(examDate ? { examDate } : {}),
          hoursPerDay: Number(hoursPerDay),
          questionCount: 10,
        },
      });
      const created = toStoredSet(result, sourceName || 'Pasted notes', sourceText);
      const next = [created, ...safeReadSets().filter((item) => item.id !== created.id)].slice(0, 24);
      persist(next);
      setActiveSet(created);
      setActiveTab('summary');
      setSelectedAnswer(null);
      setQuestionIndex(0);
      setFlashcardIndex(0);
      setFlashcardFlipped(false);
      setNotice('Your study set is ready and saved in this browser.');
      window.setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Study materials could not be generated. Please try again.');
    }
  };

  const openSet = (set: StudySet) => {
    setActiveSet(set);
    setActiveTab('summary');
    setSelectedAnswer(null);
    setQuestionIndex(0);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const rateFlashcard = (mastered: boolean) => {
    if (!activeSet || !activeSet.keyTerms.length) return;
    const term = activeSet.keyTerms[flashcardIndex];
    const masteredTerms = new Set(activeSet.masteredTerms ?? []);
    if (mastered) masteredTerms.add(term.term);
    else masteredTerms.delete(term.term);
    const updated = { ...activeSet, masteredTerms: Array.from(masteredTerms) };
    setActiveSet(updated);
    persist(savedSets.map((set) => (set.id === updated.id ? updated : set)));
    setFlashcardIndex((index) => (index + 1) % activeSet.keyTerms.length);
    setFlashcardFlipped(false);
  };

  const deleteSet = (id: string) => {
    const next = savedSets.filter((set) => set.id !== id);
    persist(next);
    if (activeSet?.id === id) setActiveSet(null);
    setNotice('Study set removed from this browser.');
  };

  const copyOutput = async () => {
    if (!activeSet) return;
    try {
      await navigator.clipboard.writeText(outputText(activeSet, activeTab));
      setNotice('Copied to clipboard.');
    } catch {
      setError('Clipboard access was blocked. Use Download to save this output instead.');
    }
  };

  const downloadOutput = () => {
    if (!activeSet) return;
    const safeTitle = activeSet.title.replace(/[^\w-]+/g, '-').toLowerCase() || 'jaguar-study-set';
    downloadText(`${safeTitle}-${activeTab}.txt`, outputText(activeSet, activeTab));
    setNotice('Output downloaded.');
  };

  const loadSample = () => {
    setSourceName('Sample notes — photosynthesis');
    setNotes(
      'SAMPLE MATERIAL — Photosynthesis is the process by which green plants convert light energy into chemical energy. In the light-dependent reactions, chlorophyll absorbs light in the thylakoid membranes. Water molecules split and release oxygen, while ATP and NADPH are produced. The Calvin cycle takes place in the stroma and uses carbon dioxide, ATP, and NADPH to build sugar. Rubisco helps attach carbon dioxide to RuBP during carbon fixation. Stomata regulate gas exchange and water loss. The overall process stores energy in glucose and supports most food chains.',
    );
    setFileError('');
    setError('');
    setNotice('Sample text loaded. It is not your uploaded material.');
  };

  const currentQuestion = activeSet?.questions[questionIndex];
  const currentTerm = activeSet?.keyTerms[flashcardIndex];
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void takeFile(event.dataTransfer.files[0]);
  };
  const closeOutput = () => setActiveSet(null);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Jaguar study workspace">
        <div className="brand">
          <div className="brand-mark"><PawPrint size={21} strokeWidth={2.2} aria-hidden="true" /></div>
          <div>
            <div className="brand-name">jaguar</div>
            <div className="brand-caption">study den</div>
          </div>
        </div>
        <div className="side-label">Your workspace</div>
        <nav className="side-nav" aria-label="Workspace sections">
          <button className="nav-item active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} data-testid="nav-create">
            <Plus size={16} aria-hidden="true" /> New study set
          </button>
          <button className="nav-item" onClick={() => document.getElementById('saved-sets')?.scrollIntoView({ behavior: 'smooth' })} data-testid="nav-saved">
            <FolderOpen size={16} aria-hidden="true" /> Saved study sets
            <span className="nav-count">{savedSets.length.toString().padStart(2, '0')}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <div className="privacy-title"><LockKeyhole size={14} aria-hidden="true" /> Your notes stay yours</div>
            <p>Files are read in your browser. Only extracted text is sent for generation; saved sets live in this browser.</p>
          </div>
          <div className="sidebar-foot">A LITTLE MORE READY, EVERY DAY</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumb">WORKSPACE <span aria-hidden="true">/</span> <strong>Study den</strong></div>
          <div className="top-status">
            <span className="local-pill"><span className="status-dot" /> AI study mode</span>
            <div className="avatar" aria-label="Student profile">ST</div>
          </div>
        </header>

        <div className="workspace">
          <section aria-labelledby="welcome-title">
            <div className="welcome-row">
              <div>
                <div className="eyebrow">Your next good study session starts here</div>
                <h1 id="welcome-title">Make your notes<br className="mobile-break" /> work harder.</h1>
                <p className="welcome-copy">Bring your course material. Jaguar will shape it into a <strong>clear plan to study.</strong></p>
              </div>
              <div className="streak-note">
                <div className="streak-icon"><Flame size={17} aria-hidden="true" /></div>
                <span>Small steps count.<br /><strong>Start with what you have.</strong></span>
              </div>
            </div>

            <div className="notice" role="note">
              <Sparkles className="notice-icon" size={16} aria-hidden="true" />
              <div><strong>AI study mode.</strong> Extracted study text is sent to OpenAI to create your materials. Raw files are parsed in your browser and never uploaded. Saved sets stay in this browser. Avoid including sensitive personal details.</div>
            </div>
          </section>

          <section className="builder-grid" aria-label="Create a study set">
            <div className="panel source-panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Bring your material</h2>
                  <p className="panel-subtitle">Paste lecture notes or add a course file. Jaguar works from your source.</p>
                </div>
                <div className="step-label"><b>01</b> / SOURCE</div>
              </div>
              <label className="input-label" htmlFor="notes-input">Your notes or reading</label>
              <textarea
                id="notes-input"
                className="source-textarea"
                placeholder="Paste the notes you want to study…"
                value={notes}
                maxLength={MAX_SOURCE_CHARS}
                onChange={(event) => { setNotes(event.target.value); setSourceName('Pasted notes'); }}
                data-testid="input-notes"
              />
              <div className="source-footer">
                <span>{notes.trim().length.toLocaleString()} characters</span>
                <button className="quiet-button" type="button" onClick={loadSample} data-testid="button-sample">Try sample notes</button>
              </div>
              <div
                className={`upload-zone${dragging ? ' dragging' : ''}`}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                aria-label="Drop a course file to extract its text"
              >
                <Upload size={17} className="upload-icon" aria-hidden="true" />
                <div className="upload-copy">
                  <strong>Drop a file here, or browse</strong>
                  <span>PDF, DOCX, PPTX, TXT, MD, CSV · up to 15 MB · read on this device</span>
                </div>
                <button className="file-button" type="button" onClick={() => fileInput.current?.click()} data-testid="button-browse">Browse files</button>
                <input ref={fileInput} className="sr-only" type="file" accept={ACCEPTED} onChange={(event) => void takeFile(event.target.files?.[0])} data-testid="input-file" aria-label="Choose a study file" />
              </div>
              {sourceName !== 'Pasted notes' && (
                <div className="selected-file" data-testid="text-selected-file">
                  <FileText size={14} aria-hidden="true" /> <span>{sourceName}</span>
                  <button className="icon-button" type="button" onClick={() => { setSourceName('Pasted notes'); setNotes(''); }} aria-label="Remove selected file text" data-testid="button-clear-file"><X size={13} /></button>
                </div>
              )}
              {fileError && <div className="error-message" role="alert" data-testid="error-file">{fileError}</div>}
              {isReading && <div className="loading-bar" aria-label="Extracting your file text" role="progressbar" />}
            </div>

            <div className="panel settings-panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Set your pace</h2>
                  <p className="panel-subtitle">A little context makes the plan more useful.</p>
                </div>
                <div className="step-label"><b>02</b> / PLAN</div>
              </div>
              <div className="setting-row">
                <label className="setting-label" htmlFor="exam-date"><span>Exam date</span><small>Optional</small></label>
                <input id="exam-date" className="field" type="date" min={new Date().toISOString().slice(0, 10)} value={examDate} onChange={(event) => setExamDate(event.target.value)} data-testid="input-exam-date" />
              </div>
              <div className="setting-row">
                <label className="setting-label" htmlFor="hours-day"><span>Study time each day</span><small>Hours</small></label>
                <select id="hours-day" className="field" value={hoursPerDay} onChange={(event) => setHoursPerDay(event.target.value)} data-testid="select-hours">
                  <option value="0.5">30 minutes</option><option value="1">1 hour</option><option value="1.5">1.5 hours</option><option value="2">2 hours</option><option value="3">3 hours</option><option value="4">4 hours</option>
                </select>
                <p className="helper">Jaguar uses your exam date and daily time to shape the study plan.</p>
              </div>
              {error && <div className="error-message" role="alert" data-testid="error-generation"><AlertCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />{error}</div>}
              <button className="primary-button" type="button" onClick={() => void onGenerate()} disabled={isPending} data-testid="button-generate">
                {isPending ? <><LoaderCircle size={16} className="spin-icon" aria-hidden="true" /> {isReading ? 'Reading your material…' : 'Making your study set…'}</> : <><Sparkles size={16} aria-hidden="true" /> Build my study set <ChevronRight size={15} aria-hidden="true" /></>}
              </button>
              {generate.isPending && <div className="loading-bar" aria-label="Generating study materials" role="progressbar" />}
            </div>
          </section>

          <section id="saved-sets" aria-labelledby="saved-heading">
            <div className="section-heading">
              <div><h2 id="saved-heading">Back to your den</h2><p>Your study sets are saved only in this browser.</p></div>
              {savedSets.length > 0 && <span className="step-label">{savedSets.length} SAVED</span>}
            </div>
            {savedSets.length === 0 ? (
              <div className="empty-state" data-testid="empty-saved">
                <div><div className="empty-state-icon"><Bookmark size={17} aria-hidden="true" /></div><strong>No saved sets just yet</strong><p>Build a set from your notes and it will be waiting here next time.</p></div>
              </div>
            ) : (
              <div className="saved-grid">
                {savedSets.map((set) => (
                  <article className="saved-card" key={set.id} data-testid={`card-study-set-${set.id}`}>
                    <div className="saved-card-top">
                      <span className="step-label">STUDY SET</span>
                      <div className="saved-actions">
                        <button className="icon-button" type="button" onClick={() => openSet(set)} aria-label={`Open ${displayText(set.title)}`} data-testid={`button-open-${set.id}`}><BookOpen size={13} /></button>
                        <button className="icon-button danger" type="button" onClick={() => deleteSet(set.id)} aria-label={`Delete ${set.title}`} data-testid={`button-delete-${set.id}`}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <button className="saved-open" type="button" onClick={() => openSet(set)} data-testid={`title-study-set-${set.id}`}>
                      <h3>{displayText(set.title, 'Study set')}</h3>
                      <div className="saved-meta">{formatDate(set.createdAt.slice(0, 10))} · {set.questions.length} practice questions</div>
                      <div className="saved-source">{displayText(set.sourceName, 'Course material')}</div>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          {activeSet && (
            <section className="output-area" ref={outputRef} aria-labelledby="output-heading" data-testid="section-study-output">
              <div className="output-head">
                <div>
                  <div className="eyebrow">Your study set</div>
                  <h2 id="output-heading">{displayText(activeSet.title, 'Study set')}</h2>
                  <p>Built from {displayText(activeSet.sourceName, 'course material')} · saved in this browser</p>
                </div>
                <div className="output-actions">
                  <button className="quiet-button" type="button" onClick={() => void copyOutput()} data-testid="button-copy-output"><Copy size={13} /> Copy</button>
                  <button className="quiet-button" type="button" onClick={downloadOutput} data-testid="button-download-output"><ArrowDownToLine size={13} /> Download</button>
                  <button className="icon-button" type="button" onClick={closeOutput} aria-label="Close study output" data-testid="button-close-output"><X size={14} /></button>
                </div>
              </div>
              <div className="tabs" role="tablist" aria-label="Study material views">
                {([
                  ['summary', 'Summary', BookOpen],
                  ['terms', 'Key terms', KeyRound],
                  ['flashcards', 'Flashcards', Layers],
                  ['practice', 'Practice test', CircleHelp],
                  ['cram', 'Cram sheet', Lightbulb],
                  ['plan', 'Study plan', ListChecks],
                ] as const).map(([tab, label, Icon]) => (
                  <button key={tab} className={`tab-button${activeTab === tab ? ' selected' : ''}`} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => { setActiveTab(tab); setSelectedAnswer(null); setQuestionIndex(0); setFlashcardFlipped(false); }} data-testid={`tab-${tab}`}>
                    <Icon size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} aria-hidden="true" />{label}
                  </button>
                ))}
              </div>
              <div className="panel output-card" role="tabpanel">
                {activeTab === 'summary' && (
                  activeSet.summary
                    ? <div className="summary-copy" data-testid="text-summary">{displayText(activeSet.summary)}</div>
                    : <div className="empty-state"><div><strong>No summary was returned</strong><p>Try generating this study set again from the source notes.</p></div></div>
                )}
                {activeTab === 'terms' && (
                  activeSet.keyTerms.length
                    ? <div className="term-grid">{activeSet.keyTerms.map((term, index) => <article className="term-card" key={`${term.term}-${index}`} data-testid={`term-card-${index}`}><strong>{displayText(term.term)}</strong><p>{displayText(term.definition)}</p></article>)}</div>
                    : <div className="empty-state"><div><div className="empty-state-icon"><KeyRound size={17} /></div><strong>No key terms yet</strong><p>This source did not produce a term list.</p></div></div>
                )}
                {activeTab === 'flashcards' && (
                  activeSet.keyTerms.length && currentTerm ? (
                    <div className="flashcards-review">
                      <div className="flashcards-status">
                        <span>Card {flashcardIndex + 1} of {activeSet.keyTerms.length}</span>
                        <span>{(activeSet.masteredTerms ?? []).length} mastered</span>
                      </div>
                      <button
                        className={`flashcard${flashcardFlipped ? ' is-flipped' : ''}`}
                        type="button"
                        onClick={() => setFlashcardFlipped((flipped) => !flipped)}
                        aria-label={flashcardFlipped ? 'Show flashcard term' : 'Reveal flashcard definition'}
                        data-testid="button-flip-flashcard"
                      >
                        <span className="flashcard-label">{flashcardFlipped ? 'DEFINITION' : 'TERM'}</span>
                        <strong>{displayText(flashcardFlipped ? currentTerm.definition : currentTerm.term)}</strong>
                        <span className="flashcard-hint">{flashcardFlipped ? 'Tap to see the term' : 'Think of the definition, then tap to reveal'}</span>
                      </button>
                      <div className="flashcard-actions">
                        <button className="flashcard-again" type="button" onClick={() => rateFlashcard(false)} disabled={!flashcardFlipped} data-testid="button-flashcard-again">Still learning</button>
                        <button className="flashcard-mastered" type="button" onClick={() => rateFlashcard(true)} disabled={!flashcardFlipped} data-testid="button-flashcard-mastered"><CheckCircle2 size={14} /> Got it</button>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state"><div><div className="empty-state-icon"><Layers size={17} /></div><strong>No flashcards yet</strong><p>Generate a study set with key terms to start reviewing.</p></div></div>
                  )
                )}
                {activeTab === 'cram' && (
                  activeSet.cramPoints.length
                    ? <ul className="cram-list">{activeSet.cramPoints.map((point, index) => <li key={`${index}-${point}`} data-testid={`cram-point-${index}`}><span className="cram-dot">{String(index + 1).padStart(2, '0')}</span><span>{displayText(point)}</span></li>)}</ul>
                    : <div className="empty-state"><div><div className="empty-state-icon"><Lightbulb size={17} /></div><strong>No cram points yet</strong><p>Try generating materials again from your source.</p></div></div>
                )}
                {activeTab === 'plan' && (
                  activeSet.studyPlan.length
                    ? <div className="plan-list">{activeSet.studyPlan.map((day, index) => <article className="plan-row" key={`${day.date}-${index}`} data-testid={`plan-day-${index}`}><div className="plan-date">{formatDate(day.date)}</div><div><h3>{displayText(day.focus)}</h3>{day.tasks.map((task, taskIndex) => <p key={`${taskIndex}-${task}`}>{displayText(task)}</p>)}</div></article>)}</div>
                    : <div className="empty-state"><div><div className="empty-state-icon"><Clock3 size={17} /></div><strong>No study plan yet</strong><p>Add an exam date and generate a fresh plan.</p></div></div>
                )}
                {activeTab === 'practice' && (
                  activeSet.questions.length && currentQuestion ? (
                    <div className="quiz-card">
                      <div className="quiz-top"><span>PRACTICE ROUND</span><span>{questionIndex + 1} / {activeSet.questions.length}</span></div>
                      <div className="quiz-progress"><span style={{ width: `${((questionIndex + 1) / activeSet.questions.length) * 100}%` }} /></div>
                      <h3 className="quiz-prompt">{displayText(currentQuestion.prompt)}</h3>
                      <div className="choices">
                        {currentQuestion.choices.map((choice, index) => {
                          const answered = selectedAnswer !== null;
                          const isAnswer = index === currentQuestion.answerIndex;
                          const isChosen = selectedAnswer === index;
                          const state = answered && isAnswer ? ' correct' : answered && isChosen ? ' incorrect' : isChosen ? ' selected' : '';
                          return (
                            <button className={`choice${state}`} type="button" key={`${index}-${choice}`} disabled={answered} onClick={() => setSelectedAnswer(index)} data-testid={`choice-${index}`}>
                              <span className="choice-letter">{String.fromCharCode(65 + index)}</span><span>{displayText(choice)}</span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedAnswer !== null && (
                        <div className={`feedback ${selectedAnswer === currentQuestion.answerIndex ? 'good' : 'bad'}`} role="status" data-testid="quiz-feedback">
                          <strong>{selectedAnswer === currentQuestion.answerIndex ? 'That’s it.' : 'Not quite.'}</strong> {displayText(currentQuestion.explanation)}
                        </div>
                      )}
                      <div className="quiz-actions">
                        {selectedAnswer === null ? (
                          <span className="helper">Choose the answer that fits your notes.</span>
                        ) : questionIndex < activeSet.questions.length - 1 ? (
                          <button className="small-primary" type="button" onClick={() => { setQuestionIndex((index) => index + 1); setSelectedAnswer(null); }} data-testid="button-next-question">Next question <ChevronRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /></button>
                        ) : (
                          <button className="small-primary" type="button" onClick={() => { setQuestionIndex(0); setSelectedAnswer(null); }} data-testid="button-restart-quiz"><RotateCcw size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />Practice again</button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state"><div><div className="empty-state-icon"><CircleHelp size={17} /></div><strong>No practice questions yet</strong><p>Generate a fresh set from a longer section of course material.</p></div></div>
                  )
                )}
              </div>
            </section>
          )}
        </div>
      </main>
      {notice && <div className="toast-message" role="status" data-testid="status-toast"><CheckCircle2 size={15} aria-hidden="true" />{notice}</div>}
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
