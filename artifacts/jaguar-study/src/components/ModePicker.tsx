import { useEffect, useRef } from 'react';
import { BookOpen, Check, GraduationCap, Layers, ListChecks, PenLine, Timer, X } from 'lucide-react';
import type { StudyMode } from '@/study';

export const MODE_INFO: { id: StudyMode; label: string; Icon: typeof BookOpen }[] = [
  { id: 'timed', label: 'Time based exam', Icon: Timer },
  { id: 'tutor', label: 'Tutor Lesson', Icon: GraduationCap },
  { id: 'summary', label: 'Note Summary', Icon: BookOpen },
  { id: 'objective', label: 'Objective', Icon: ListChecks },
  { id: 'cram', label: 'Cram Sheet', Icon: Layers },
  { id: 'theory', label: 'Theory', Icon: PenLine },
];
export const ALL_MODES = MODE_INFO.map((m) => m.id);
export const modeLabel = (id: string) => MODE_INFO.find((m) => m.id === id)?.label ?? id;

export function ModeGrid({ modes, onModes }: { modes: StudyMode[]; onModes: (m: StudyMode[]) => void }) {
  const all = modes.length === MODE_INFO.length;
  const toggle = (id: StudyMode) => onModes(modes.includes(id) ? modes.filter((m) => m !== id) : ALL_MODES.filter((m) => m === id || modes.includes(m)));
  return (
    <fieldset className="mode-picker">
      <div className="mode-picker-head">
        <legend>What do you want?</legend>
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
              <span className="mode-icon"><Icon size={15} /></span>
              <span className="mode-text"><strong>{label}</strong></span>
              <span className="tick"><Check size={11} /></span>
            </label>
          );
        })}
      </div>
      {modes.length === 0 && <p className="field-error" role="alert" data-testid="error-modes">Pick at least one mode.</p>}
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
        <span>Objective questions</span>
        <input className="field" type="number" inputMode="numeric" min={1} max={50} step={1} value={questionCount} onChange={(e) => onQuestionCount(e.target.value)} data-testid="input-question-count" />
        {countError && <em className="field-error" role="alert">{countError}</em>}
      </label>
      {modes.includes('timed') && (
        <label>
          <span>Exam duration (minutes)</span>
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
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="mode-dialog-title" data-testid="dialog-mode-picker">
        <div className="modal-head">
          <div><span className="eyebrow">Build it your way</span><h2 id="mode-dialog-title">How do you want to study it?</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close" data-testid="button-close-modes"><X size={14} /></button>
        </div>
        <ModeGrid modes={modes} onModes={onModes} />
        <ModeNumbers modes={modes} {...nums} />
        {error && <p className="field-error" role="alert" data-testid="error-dialog-generation">{error}</p>}
        <button ref={ref} className="primary-button generate" type="button" disabled={!modes.length || busy} aria-busy={busy} onClick={() => { if (!busy) onGenerate(); }} data-testid="button-generate">
          {busy ? 'Starting...' : `Generate ${modes.length} ${modes.length === 1 ? 'mode' : 'modes'}`}
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
