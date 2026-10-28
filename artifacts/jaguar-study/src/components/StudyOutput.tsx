import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDownToLine, Copy, Eye, EyeOff, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import type { StudySet } from '@/study';
import { RichNotes } from './RichNotes';
import { StudyText } from './StudyText';
import { SourceViewer } from './SourceViewer';
import { TimedExam } from './TimedExam';
import { TheoryTest } from './TheoryTest';
import { Flashcards, ObjectivePractice } from './Practice';
import { PersonalNotes } from './PersonalNotes';
import type { StoredSource } from '@/lib/source-store';

import { setViews, type OutputTab } from '@/lib/study-views';
export { setModes, setViews, studyViews, type OutputTab } from '@/lib/study-views';

const L = (i: number) => String.fromCharCode(65 + i);

export function outputText(set: StudySet, tab: OutputTab, clean: (s: string) => string): string {
  if (tab === 'summary') return clean(set.summary);
  if (tab === 'terms' || tab === 'flashcards') return set.keyTerms.map((t) => `${clean(t.term)}\n${clean(t.definition)}`).join('\n\n');
  if (tab === 'cram') return set.cramPoints.map((p) => `- ${clean(p)}`).join('\n');
  if (tab === 'tutor') return clean(set.tutorLesson ?? '');
  if (tab === 'personal-notes') return '';
  if (tab === 'theory') return (set.theoryQuestions ?? []).map((q, i) => `${i + 1}. ${clean(q.prompt)}\n${q.parts.map((p) => `(${p.label}) ${clean(p.question)}\nModel answer: ${clean(p.modelAnswer)}`).join('\n')}`).join('\n\n');
  return set.questions.map((q, i) => `${i + 1}. ${clean(q.prompt)}\n${q.choices.map((c, j) => `${L(j)}. ${clean(c)}`).join('\n')}\nAnswer: ${L(q.answerIndex)}\n${clean(q.explanation)}`).join('\n\n');
}

type Props = {
  set: StudySet; userId: string; synced: boolean; clean: (s: string) => string;
  sources: StoredSource[] | null; onReattach: (files: File[]) => void;
  onRate: (term: string, ok: boolean) => void; onClose: () => void; notify: (msg: string) => void;
  tab?: OutputTab; onTab?: (t: OutputTab) => void;
};

const SPLIT_KEY = 'jaguar-source-split';
const SHOW_KEY = 'jaguar-source-visible';
const READ_KEY = 'jaguar-read-size';
const READ_SIZES = [15, 16.5, 18, 19.5];
const MIN_SRC = 15, MAX_SRC = 70;
const clampSrc = (n: number) => Math.round(Math.max(MIN_SRC, Math.min(MAX_SRC, n)));
function readNum(k: string, d: number) { try { const v = Number(localStorage.getItem(k)); return Number.isFinite(v) && v > 0 ? clampSrc(v) : d; } catch { return d; } }
function readBool(k: string, d: boolean) { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } }

export function StudyOutput({ set, userId, synced, clean, sources, onReattach, onRate, onClose, notify, tab: ctrlTab, onTab }: Props) {
  const tabs = setViews(set);
  const valid = (t?: OutputTab) => !!t && tabs.some((x) => x.id === t);

  // Single source of truth: parent tab wins when valid; local tab is a fallback; reset synchronously per set.
  const [own, setOwn] = useState<{ setId: string; tab: OutputTab }>({ setId: set.id, tab: tabs[0].id });
  const ownTab = own.setId === set.id && valid(own.tab) ? own.tab : tabs[0].id;
  const tab: OutputTab = valid(ctrlTab) ? ctrlTab! : ownTab;
  const setTab = (t: OutputTab) => { setOwn({ setId: set.id, tab: t }); onTab?.(t); };
  const onTabRef = useRef(onTab); onTabRef.current = onTab;
  // Tell the parent which tab is really showing so the rail highlight never drifts.
  useEffect(() => { if (ctrlTab !== tab) onTabRef.current?.(tab); }, [tab, ctrlTab]);

  // Keep visited panels mounted (hidden) so timed exam / theory answers never reset on switches.
  const [visited, setVisited] = useState<{ setId: string; tabs: OutputTab[] }>({ setId: set.id, tabs: [tab] });
  const seen = visited.setId === set.id ? visited.tabs : [];
  if (!seen.includes(tab)) setVisited({ setId: set.id, tabs: [...seen, tab] });
  const mounted = seen.includes(tab) ? seen : [...seen, tab];

  const [showNotes, setShowNotes] = useState(true);
  const [showSource, setShowSourceRaw] = useState(() => readBool(SHOW_KEY, true));
  const [srcPct, setSrcPctRaw] = useState(() => readNum(SPLIT_KEY, 30));
  const [full, setFull] = useState(false);
  const [readIdx, setReadIdxRaw] = useState(() => { try { const raw = localStorage.getItem(READ_KEY); const v = raw === null ? 1 : Number(raw); return Number.isInteger(v) && v >= 0 && v < READ_SIZES.length ? v : 1; } catch { return 1; } });
  const setReadIdx = (n: number) => { const c = Math.max(0, Math.min(READ_SIZES.length - 1, n)); setReadIdxRaw(c); try { localStorage.setItem(READ_KEY, String(c)); } catch { /* ignore */ } };
  const reading = tab === 'summary' || tab === 'tutor' || tab === 'cram' || tab === 'terms';
  const setShowSource = (v: boolean) => { setShowSourceRaw(v); try { localStorage.setItem(SHOW_KEY, v ? '1' : '0'); } catch { /* ignore */ } };
  const setSrcPct = (n: number) => { const c = clampSrc(n); setSrcPctRaw(c); try { localStorage.setItem(SPLIT_KEY, String(c)); } catch { /* ignore */ } };
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lastSet, setLastSet] = useState(set.id);
  if (lastSet !== set.id) { setLastSet(set.id); setShowNotes(true); setFull(false); }

  useEffect(() => {
    if (!full) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = closeRef.current?.closest<HTMLElement>('.output-area');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setFull(false); return; }
      if (e.key !== 'Tab' || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'))
        .filter((item) => item.getClientRects().length > 0);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [full]);

  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = bodyRef.current; if (!box) return;
    e.preventDefault();
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => { const r = box.getBoundingClientRect(); setSrcPct(((r.right - ev.clientX) / r.width) * 100); };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  const onDividerKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 5;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setSrcPct(srcPct + step); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setSrcPct(srcPct - step); }
    else if (e.key === 'Home') { e.preventDefault(); setSrcPct(MAX_SRC); }
    else if (e.key === 'End') { e.preventDefault(); setSrcPct(MIN_SRC); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(outputText(set, tab, clean)); notify('Copied to clipboard.'); } catch { notify('Clipboard blocked. Use Download instead.'); }
  };
  const download = () => {
    const blob = new Blob([outputText(set, tab, clean)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(set.title.replace(/[^\w-]+/g, '-').toLowerCase() || 'jaguar')}-${tab}.txt`; a.click();
    URL.revokeObjectURL(url); notify('Downloaded.');
  };
  const minutes = set.examMinutes ?? 120;
  const key = `${userId}:${set.id}`;
  const label = tabs.find((t) => t.id === tab)?.label ?? 'Study';

  const panel = (id: OutputTab) => {
    switch (id) {
      case 'summary': return (<>
        <div className="pane-tools"><button className="quiet-button" type="button" onClick={() => setShowNotes((v) => !v)} aria-expanded={showNotes} data-testid="button-toggle-summary">{showNotes ? <><EyeOff size={13} /> Hide notes</> : <><Eye size={13} /> Reveal notes</>}</button></div>
        {!showNotes ? <div className="notes-hidden" data-testid="text-summary-hidden">Try to recall the main points, then reveal the notes to check.</div>
          : set.summary ? <div className="doc doc-summary"><RichNotes text={clean(set.summary)} testId="text-summary" /></div> : <div className="empty-state"><strong>No summary in this set</strong><p>Try making the set again with Note summary selected.</p></div>}
      </>);
      case 'timed': return <TimedExam key={`exam-${key}`} title={set.title || 'Examination'} questions={set.questions} theory={set.theoryQuestions ?? []} minutes={minutes} storageKey={`jaguar-exam-${key}`} clean={clean} />;
      case 'objective': return <ObjectivePractice questions={set.questions} clean={clean} setId={set.id} />;
      case 'theory': return <TheoryTest key={`theory-${key}`} questions={set.theoryQuestions ?? []} storageKey={`jaguar-theory-${key}`} clean={clean} />;
       case 'terms': return set.keyTerms.length ? <div className="term-grid">{set.keyTerms.map((t, i) => <article className="term-card" key={i} data-testid={`term-card-${i}`}><strong>{clean(t.term)}</strong><p>{clean(t.definition)}</p></article>)}</div> : <div className="empty-state"><strong>No key terms to show</strong></div>;
      case 'flashcards': return <Flashcards terms={set.keyTerms} mastered={set.masteredTerms ?? []} onRate={onRate} clean={clean} setId={set.id} />;
       case 'cram': return set.cramPoints.length ? <ul className="cram-list doc doc-cram">{set.cramPoints.map((p, i) => <li key={i} data-testid={`cram-point-${i}`}><span className="cram-dot">{i + 1}.</span><span><StudyText text={clean(p)} /></span></li>)}</ul> : <div className="empty-state"><strong>No cram sheet in this set</strong></div>;
       case 'tutor': return set.tutorLesson ? <div className="doc doc-tutor"><RichNotes text={clean(set.tutorLesson)} testId="text-tutor-lesson" /></div> : <div className="empty-state"><strong>No tutor lesson in this set</strong><p>Choose Tutor lesson when you make the set.</p></div>;
      case 'personal-notes': return <PersonalNotes key={`personal-notes-${key}`} userId={userId} setId={set.id} />;
    }
  };

  const sourceToggle = (
    <button className={`quiet-button source-toggle${showSource ? '' : ' off'}`} type="button" onClick={() => setShowSource(!showSource)} aria-pressed={showSource} data-testid="button-toggle-source">
      {showSource ? <><PanelRightClose size={13} /> Hide slideshow</> : <><PanelRightOpen size={13} /> Show slideshow</>}
    </button>
  );

  return (
    <section className={`output-area${full ? ' is-full' : ''}`} aria-labelledby="output-heading" data-testid="section-study-output" {...(full ? { role: 'dialog', 'aria-modal': true, 'aria-label': `${label}, fullscreen` } : {})}>
      <div className="output-head">
        <div className="output-title">
          <h2 id="output-heading" data-testid="text-set-title">{clean(set.title) || 'Study set'}</h2>
          <p><span className="output-source" title={clean(set.sourceName) || undefined}>{clean(set.sourceName) || 'Your notes'}</span><span aria-hidden="true"> · </span>{synced ? 'Synced' : 'Saved on this browser'}</p>
        </div>
        <div className="output-actions">
          {full && <label className="view-select">
            <span className="sr-only">Study view</span>
            <select value={tab} onChange={(e) => setTab(e.target.value as OutputTab)} data-testid="select-fullscreen-view">
              {tabs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>}
          {tab !== 'timed' && tab !== 'personal-notes' && <>
          <button className="quiet-button" type="button" onClick={() => void copy()} data-testid="button-copy-output"><Copy size={13} /> Copy</button>
          <button className="quiet-button" type="button" onClick={download} data-testid="button-download-output"><ArrowDownToLine size={13} /> Download</button>
          </>}
          {full
            ? <button ref={closeRef} className="quiet-button" type="button" onClick={() => setFull(false)} data-testid="button-close-fullscreen"><Minimize2 size={13} /> Exit <kbd>Esc</kbd></button>
            : <button className="quiet-button" type="button" onClick={() => setFull(true)} data-testid="button-fullscreen"><Maximize2 size={13} /> Fullscreen</button>}
          {!full && <button className="icon-button" type="button" onClick={onClose} aria-label="Close study set" data-testid="button-close-output"><X size={14} /></button>}
        </div>
      </div>
      <div className="study-toolbar">
        <div className="split-controls">
          {reading && <div className="read-size" role="group" aria-label="Text size">
            <button className="quiet-button" type="button" onClick={() => setReadIdx(readIdx - 1)} disabled={readIdx === 0} aria-label="Smaller text" data-testid="button-text-smaller">A-</button>
            <button className="quiet-button" type="button" onClick={() => setReadIdx(readIdx + 1)} disabled={readIdx === READ_SIZES.length - 1} aria-label="Larger text" data-testid="button-text-larger">A+</button>
          </div>}
          {sourceToggle}
          {showSource && <div className="split-size" role="group" aria-label="Space split">
            <button className="quiet-button" type="button" onClick={() => setSrcPct(srcPct - 10)} disabled={srcPct <= MIN_SRC} data-testid="button-more-study">More study</button>
            <input type="range" min={MIN_SRC} max={MAX_SRC} step={1} value={srcPct} onChange={(e) => setSrcPct(Number(e.target.value))} aria-label="Slideshow share of space" aria-valuetext={`Slideshow ${srcPct} percent, study ${100 - srcPct} percent`} data-testid="slider-split" />
            <button className="quiet-button" type="button" onClick={() => setSrcPct(srcPct + 10)} disabled={srcPct >= MAX_SRC} data-testid="button-more-source">More slideshow</button>
          </div>}
        </div>
      </div>

      <div ref={bodyRef} className={`study-split${showSource ? ' with-source' : ''}`} style={{ ['--src' as string]: `${srcPct}%` }} data-testid="layout-study-split">
        <div className={`panel output-card study-pane${reading ? ' is-reading' : ''}`} style={{ ['--read-size' as string]: `${READ_SIZES[readIdx]}px` }}>
          {mounted.map((id) => (
            <div key={id} role="region" id={`panel-${id}`} aria-label={tabs.find((t) => t.id === id)?.label ?? 'Study'} hidden={id !== tab} data-testid={`panel-${id}`}>{panel(id)}</div>
          ))}
        </div>
        {showSource && <div className="split-divider" role="separator" aria-orientation="vertical" aria-label="Resize slideshow and study" aria-valuemin={100 - MAX_SRC} aria-valuemax={100 - MIN_SRC} aria-valuenow={100 - srcPct} aria-valuetext={`Study ${100 - srcPct} percent`} tabIndex={0} onPointerDown={onDragStart} onKeyDown={onDividerKey} onDoubleClick={() => setSrcPct(30)} data-testid="divider-split"><span /></div>}
        <div className="panel source-pane" hidden={!showSource} aria-label="Source slideshow" data-testid="pane-source">
          <SourceViewer sources={sources} onReattach={onReattach} />
        </div>
      </div>
    </section>
  );
}
