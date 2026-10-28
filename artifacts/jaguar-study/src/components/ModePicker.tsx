import { useEffect, useRef } from 'react';
import { BookOpen, Check, GraduationCap, Layers, ListChecks, PenLine, Timer, X } from 'lucide-react';
import type { StudyMode } from '@/study';

export const MODE_INFO: { id: StudyMode; label: string; Icon: typeof BookOpen }[] = [
  { id: 'timed', label: 'Timed exam', Icon: Timer },
  { id: 'tutor', label: 'Tutor lesson', Icon: GraduationCap },
  { id: 'summary', label: 'Note summary', Icon: BookOpen },
  { id: 'objective', label: 'Objective questions', Icon: ListChecks },
  { id: 'cram', label: 'Cram sheet', Icon: Layers },
  { id: 'theory', label: 'Theory test', Icon: PenLine },
];
export const ALL_MODES = MODE_INFO.map((m) => m.id);
export const modeLabel = (id: string) => MODE_INFO.find((m) => m.id === id)?.label ?? id;

export function ModeGrid({ modes, onModes }: { modes: StudyMode[]; onModes: (m: StudyMode[]) => void }) {
  const all = modes.length === MODE_INFO.length;
  const toggle = (id: StudyMode) => onModes(modes.includes(id) ? modes.filter((m) => m !== id) : ALL_MODES.filter((m) => m === id || modes.includes(m)));
  return (
    <fieldset className="mode-picker">
       <legend className="mode-legend">Choose formats</legend>
      <div className="mode-picker-head">
        <label className="select-all">
          <input type="checkbox" checked={all} onChange={() => onModes(all ? [] : [...ALL_MODES])} data-testid="toggle-select-all" />
          <span className="tick"><Check size={11} /></span> Select all
        </label>
      </div>
      <div className="mode-grid">
        {MODE_INFO.map(({ id, label, Icon }) => {
          const on = modes.includes(id);
          return (
            <label key={id} className={`mode-chip${on ? ' on' : ''}`} data-testid={`toggle-mode-${id}`}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(id)} />
              <Icon size={15} className="mode-icon-plain" aria-hidden="true" />
              <span className="mode-text"><strong>{label}</strong></span>
              <span className="tick"><Check size={11} /></span>
            </label>
          );
        })}
      </div>
      {modes.length === 0 && <p className="field-error" role="alert" data-testid="error-modes">Choose at least one format.</p>}
    </fieldset>
  );
}

type NumProps = {
  modes: StudyMode[]; questionCount: string; onQuestionCount: (v: string) => void;
  examMinutes: string; onExamMinutes: (v: string) => void; countError: string; minutesError: string;
};

export function ModeNumbers({ modes, questionCount, onQuestionCount, examMinutes, onExamMinutes, countError, minutesError }: NumProps) {
  const needsQuestions = modes.includes('objective') || modes.includes('timed');
  if (!needsQuestions) return null;
  return (
    <div className="mode-numbers">
      <label>
          <span>Number of objective questions (1–50)</span>
        <input className="field" type="number" inputMode="numeric" min={1} max={50} step={1} value={questionCount} onChange={(e) => onQuestionCount(e.target.value)} data-testid="input-question-count" />
        {countError && <em className="field-error" role="alert">{countError}</em>}
      </label>
      {modes.includes('timed') && (
        <label>
          <span>Time limit (minutes)</span>
          <input className="field" type="number" inputMode="numeric" min={1} max={180} step={1} value={examMinutes} onChange={(e) => onExamMinutes(e.target.value)} data-testid="input-exam-minutes" />
          {minutesError && <em className="field-error" role="alert">{minutesError}</em>}
        </label>
      )}
    </div>
  );
}

type DialogProps = NumProps & { open: boolean; onModes: (m: StudyMode[]) => void; onClose: () => void; onGenerate: () => void; busy: boolean; error: string };

export function ModeDialog({ open, modes, onModes, onClose, onGenerate, busy, error, ...nums }: DialogProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key !== 'Tab' || !card.current) return;
      const items = Array.from(card.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])'));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!card.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (back?.isConnected) back.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={card} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="mode-dialog-title" data-testid="dialog-mode-picker">
        <div className="modal-head">
          <div><h2 id="mode-dialog-title">What should I make from these notes?</h2><p className="modal-sub">Pick as many as you like. They’ll all use the files you added.</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close study modes" data-testid="button-close-modes"><X size={14} /></button>
        </div>
        <ModeGrid modes={modes} onModes={onModes} />
        <ModeNumbers modes={modes} {...nums} />
        {error && <p className="field-error" role="alert" data-testid="error-dialog-generation">{error}</p>}
        <button ref={ref} className="primary-button generate" type="button" disabled={!modes.length || busy} aria-busy={busy} onClick={() => { if (!busy) onGenerate(); }} data-testid="button-generate">
          {busy ? 'Putting them together…' : 'Make these materials'}
        </button>
      </div>
    </div>
  );
}

export function intIn(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}
