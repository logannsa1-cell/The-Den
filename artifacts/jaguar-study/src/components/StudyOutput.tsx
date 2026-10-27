import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, BookOpen, Columns2, Copy, Eye, EyeOff, GraduationCap, KeyRound, Layers, Lightbulb, ListChecks, Maximize2, PenLine, Timer, X } from 'lucide-react';
import type { StudyMode, StudySet } from '@/study';
import { RichNotes } from './RichNotes';
import { SourceViewer } from './SourceViewer';
import { TimedExam } from './TimedExam';
import { TheoryTest } from './TheoryTest';
import { Flashcards, ObjectivePractice } from './Practice';
import type { StoredSource } from '@/lib/source-store';

export type OutputTab = 'summary' | 'timed' | 'objective' | 'theory' | 'terms' | 'flashcards' | 'cram' | 'tutor';

const L = (i: number) => String.fromCharCode(65 + i);

export function setModes(set: StudySet): StudyMode[] {
  return set.modes?.length ? (set.modes as StudyMode[]) : ['summary', 'objective'];
}


export function outputText(set: StudySet, tab: OutputTab, clean: (s: string) => string): string {
  if (tab === 'summary') return clean(set.summary);
  if (tab === 'terms' || tab === 'flashcards') return set.keyTerms.map((t) => `${clean(t.term)}\n${clean(t.definition)}`).join('\n\n');
  if (tab === 'cram') return set.cramPoints.map((p) => `- ${clean(p)}`).join('\n');
  if (tab === 'tutor') return clean(set.tutorLesson ?? '');
  if (tab === 'theory') return (set.theoryQuestions ?? []).map((q, i) => `${i + 1}. ${clean(q.prompt)}\n${q.parts.map((p) => `(${p.label}) ${clean(p.question)}\nModel answer: ${clean(p.modelAnswer)}`).join('\n')}`).join('\n\n');
  return set.questions.map((q, i) => `${i + 1}. ${clean(q.prompt)}\n${q.choices.map((c, j) => `${L(j)}. ${clean(c)}`).join('\n')}\nAnswer: ${L(q.answerIndex)}\n${clean(q.explanation)}`).join('\n\n');
}

type Props = {
  set: StudySet; userId: string; synced: boolean; clean: (s: string) => string;
  sources: StoredSource[] | null; onReattach: (files: File[]) => void;
  onRate: (term: string, ok: boolean) => void; onClose: () => void; notify: (msg: string) => void;
};

export function StudyOutput({ set, userId, synced, clean, sources, onReattach, onRate, onClose, notify }: Props) {
  const modes = setModes(set);
  type T = [OutputTab, string, typeof BookOpen];
  const legacy = !set.modes?.length;
  const tabs: T[] = [
    ...(modes.includes('timed') ? [['timed', 'Timed exam', Timer] as T] : []),
    ...(modes.includes('tutor') ? [['tutor', 'Tutor Lesson', GraduationCap] as T] : []),
    ...(modes.includes('summary') ? [['summary', 'Notes', BookOpen] as T, ['terms', 'Key terms', KeyRound] as T, ['flashcards', 'Flashcards', Layers] as T] : []),
    ...(modes.includes('objective') ? [['objective', 'Objective', ListChecks] as T] : []),
    ...(modes.includes('cram') || (legacy && set.cramPoints.length) ? [['cram', 'Cram Sheet', Lightbulb] as T] : []),
    ...(modes.includes('theory') ? [['theory', 'Theory', PenLine] as T] : []),
  ];
  if (!tabs.length) tabs.push(['summary', 'Notes', BookOpen]);
  const [tab, setTab] = useState<OutputTab>(tabs[0][0]);
  const [showNotes, setShowNotes] = useState(true);
  const [split, setSplit] = useState(true);
  const [full, setFull] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setTab(tabs[0][0]); setShowNotes(true); setFull(false); }, [set.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [full]);

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

  const notesBody = set.summary ? <RichNotes text={clean(set.summary)} testId="text-summary" /> : <div className="empty-state"><strong>No notes returned</strong><p>Generate this set again.</p></div>;

  return (
    <section className="output-area" aria-labelledby="output-heading" data-testid="section-study-output">
      <div className="output-head">
        <div>
          <div className="eyebrow">{synced ? 'Synced to your account' : 'Saved on this browser'}</div>
          <h2 id="output-heading" data-testid="text-set-title">{clean(set.title) || 'Study set'}</h2>
          <p>From {clean(set.sourceName) || 'your notes'}</p>
        </div>
        <div className="output-actions">
          {tab !== 'timed' && <>
          <button className="quiet-button" type="button" onClick={() => void copy()} data-testid="button-copy-output"><Copy size={13} /> Copy</button>
          <button className="quiet-button" type="button" onClick={download} data-testid="button-download-output"><ArrowDownToLine size={13} /> Download</button>
          </>}
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close study set" data-testid="button-close-output"><X size={14} /></button>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Study views">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab-button${tab === id ? ' selected' : ''}`} onClick={() => setTab(id)} data-testid={`tab-${id}`}><Icon size={13} /> {label}</button>
        ))}
      </div>

      {tab === 'summary' ? (
        <div className={`notes-layout${split ? ' split' : ''}`}>
          <div className="panel output-card notes-pane">
            <div className="pane-tools">
              <button className="quiet-button" type="button" onClick={() => setShowNotes((v) => !v)} aria-expanded={showNotes} data-testid="button-toggle-summary">{showNotes ? <><EyeOff size={13} /> Hide notes</> : <><Eye size={13} /> Reveal notes</>}</button>
              <button className="quiet-button" type="button" onClick={() => setSplit((v) => !v)} aria-pressed={split} data-testid="button-toggle-source"><Columns2 size={13} /> {split ? 'Hide source' : 'Show source'}</button>
              <button className="quiet-button" type="button" onClick={() => setFull(true)} data-testid="button-fullscreen-summary"><Maximize2 size={13} /> Expand</button>
            </div>
            {showNotes ? notesBody : <div className="notes-hidden" data-testid="text-summary-hidden">Notes hidden. Try recalling the main ideas first, then reveal.</div>}
          </div>
          {split && <div className="panel source-pane"><SourceViewer sources={sources} onReattach={onReattach} /></div>}
        </div>
      ) : (
        <div className="panel output-card" role="tabpanel">
          {tab === 'timed' && <TimedExam key={`exam-${key}`} title={set.title || 'Examination'} questions={set.questions} theory={set.theoryQuestions ?? []} minutes={minutes} storageKey={`jaguar-exam-${key}`} clean={clean} />}
          {tab === 'objective' && <ObjectivePractice questions={set.questions} clean={clean} setId={set.id} />}
          {tab === 'theory' && <TheoryTest key={`theory-${key}`} questions={set.theoryQuestions ?? []} storageKey={`jaguar-theory-${key}`} clean={clean} />}
          {tab === 'terms' && (set.keyTerms.length ? <div className="term-grid">{set.keyTerms.map((t, i) => <article className="term-card" key={i} data-testid={`term-card-${i}`}><strong>{clean(t.term)}</strong><p>{clean(t.definition)}</p></article>)}</div> : <div className="empty-state"><strong>No key terms</strong></div>)}
          {tab === 'flashcards' && <Flashcards terms={set.keyTerms} mastered={set.masteredTerms ?? []} onRate={onRate} clean={clean} setId={set.id} />}
          {tab === 'cram' && (set.cramPoints.length ? <ul className="cram-list">{set.cramPoints.map((p, i) => <li key={i} data-testid={`cram-point-${i}`}><span className="cram-dot">{String(i + 1).padStart(2, '0')}</span><span>{clean(p)}</span></li>)}</ul> : <div className="empty-state"><strong>No cram points</strong></div>)}
          {tab === 'tutor' && (set.tutorLesson ? <RichNotes text={clean(set.tutorLesson)} testId="text-tutor-lesson" /> : <div className="empty-state"><strong>No tutor lesson in this set</strong><p>Build a new set with Tutor Lesson selected.</p></div>)}
        </div>
      )}

      {full && (
        <div className="fullscreen" role="dialog" aria-modal="true" aria-label="Expanded notes" data-testid="dialog-fullscreen-summary">
          <div className="fullscreen-bar">
            <strong>{clean(set.title)}</strong>
            <button ref={closeRef} className="quiet-button" type="button" onClick={() => setFull(false)} data-testid="button-close-fullscreen"><X size={13} /> Close <kbd>Esc</kbd></button>
          </div>
          <div className={`fullscreen-body${split ? ' split' : ''}`}>
            <div className="fullscreen-notes">{notesBody}</div>
            {split && <div className="fullscreen-source"><SourceViewer sources={sources} onReattach={onReattach} /></div>}
          </div>
        </div>
      )}
    </section>
  );
}
