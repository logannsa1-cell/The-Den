import { SubjectPrompt } from './SubjectPrompt';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, Play, RotateCcw, Send, Timer } from 'lucide-react';
import type { StudyQuestion, TheoryQuestion } from '@/study';
import { readJson, writeJson } from '@/lib/source-store';

type Answers = { obj: (number | null)[]; partA: number | null; partB: number[]; written: Record<string, string> };
type ExamState =
  | { status: 'idle' }
  | ({ status: 'running'; deadline: number; section: 'A' | 'B'; current: number } & Answers)
  | ({ status: 'done'; score: number; submittedAt: number; timedOut: boolean } & Answers);

const L = (i: number) => String.fromCharCode(65 + i);
const PART_A = [0, 1];
const PART_B = [2, 3, 4, 5, 6];
function fmt(ms: number) { const s = Math.ceil(ms / 1000); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

function chosen(a: Answers) { return [...(a.partA === null ? [] : [a.partA]), ...a.partB].sort((x, y) => x - y); }

type Props = { title: string; questions: StudyQuestion[]; theory: TheoryQuestion[]; minutes: number; storageKey: string; clean: (s: string) => string };

export function TimedExam({ title, questions, theory, minutes, storageKey, clean }: Props) {
  const key = `${storageKey}-paper-v2`;
  const [state, setState] = useState<ExamState>(() => readJson<ExamState>(key, { status: 'idle' }));
  const [now, setNow] = useState(() => Date.now());
  const submitted = useRef(state.status === 'done');
  useEffect(() => { writeJson(key, state); }, [key, state]);

  const submit = useCallback((timedOut: boolean) => {
    if (submitted.current) return;
    submitted.current = true;
    setState((s) => {
      if (s.status !== 'running') return s;
      const score = s.obj.reduce<number>((n, a, i) => n + (a === questions[i]?.answerIndex ? 1 : 0), 0);
      return { status: 'done', obj: s.obj, partA: s.partA, partB: s.partB, written: s.written, score, submittedAt: Date.now(), timedOut };
    });
  }, [questions]);

  const running = state.status === 'running';
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);
  const remaining = state.status === 'running' ? Math.max(0, state.deadline - now) : 0;
  useEffect(() => { if (state.status === 'running' && remaining <= 0) submit(true); }, [state.status, remaining, submit]);

  const start = () => {
    submitted.current = false;
    setNow(Date.now());
    setState({ status: 'running', deadline: Date.now() + minutes * 60000, section: 'A', current: 0, obj: questions.map(() => null), partA: null, partB: [], written: {} });
  };

  if (theory.length !== 7) {
    return (
      <div className="empty-state compat" data-testid="text-exam-compat">
        <div><span className="empty-state-icon"><CircleAlert size={17} /></span>
          <strong>This set uses the older exam format</strong>
          <p>The school paper needs 7 theory questions (2 in Part A, 5 in Part B). This set has {theory.length}. Build a new set with Time based exam selected to sit the full paper. Your Objective and Theory tabs still work.</p></div>
      </div>
    );
  }
  if (!questions.length) return <div className="empty-state"><strong>No objective questions in this set</strong><p>Build a new set with Time based exam selected.</p></div>;

  const header = (
    <header className="paper-head">
      <span className="eyebrow">Examination paper</span>
      <h3 data-testid="text-paper-title">{clean(title)}</h3>
      <p>Time allowed: {minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes >= 120 ? 's' : ''}${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`}</p>
    </header>
  );

  if (state.status === 'idle') {
    return (
      <div className="exam-intro paper" data-testid="exam-intro">
        {header}
        <ol className="paper-rules">
          <li><b>SECTION A · OBJECTIVE</b> Answer all {questions.length} questions. Choose one option, A to E.</li>
          <li><b>SECTION B · THEORY</b> Answer ONE question from Part A and THREE from Part B. Write your answers in full.</li>
          <li>One clock covers both sections. It keeps running if you reload and the paper submits itself when time is up.</li>
          <li>Answers and model answers stay hidden until you submit.</li>
        </ol>
        <button className="primary-button" type="button" onClick={start} data-testid="button-start-exam"><Play size={15} /> Start paper</button>
      </div>
    );
  }

  if (state.status === 'running') {
    const answered = state.obj.filter((a) => a !== null).length;
    const picks = chosen(state);
    const writtenOk = picks.every((qi) => theory[qi].parts.every((p) => (state.written[`${qi}-${p.label}`] ?? '').trim()));
    const incomplete: string[] = [];
    if (answered < questions.length) incomplete.push(`${questions.length - answered} objective unanswered`);
    if (state.partA === null) incomplete.push('no Part A question chosen');
    if (state.partB.length < 3) incomplete.push(`${3 - state.partB.length} Part B ${3 - state.partB.length === 1 ? 'question' : 'questions'} not chosen`);
    if (picks.length && !writtenOk) incomplete.push('some written parts are blank');
    const set = (fn: (s: Extract<ExamState, { status: 'running' }>) => Partial<Extract<ExamState, { status: 'running' }>>) =>
      setState((s) => (s.status === 'running' ? { ...s, ...fn(s) } : s));
    const low = remaining < 5 * 60000;
    const critical = remaining < 60000;
    const q = questions[state.current];
    const togglePartB = (qi: number) => set((s) => ({ partB: s.partB.includes(qi) ? s.partB.filter((x) => x !== qi) : s.partB.length >= 3 ? s.partB : [...s.partB, qi] }));
    return (
      <div className="exam-run paper" data-testid="exam-running">
        <div className="exam-top exam-sticky">
          <div className="section-switch" role="group" aria-label="Exam sections">
            <button type="button" aria-pressed={state.section === 'A'} className={state.section === 'A' ? 'on' : ''} onClick={() => set(() => ({ section: 'A' }))} data-testid="tab-section-a">Section A <small>{answered}/{questions.length}</small></button>
            <button type="button" aria-pressed={state.section === 'B'} className={state.section === 'B' ? 'on' : ''} onClick={() => set(() => ({ section: 'B' }))} data-testid="tab-section-b">Section B <small>{picks.length}/4</small></button>
          </div>
          <div className={`exam-clock${low ? ' low' : ''}${critical ? ' critical' : ''}`} data-testid="status-exam-clock">
            <span className="countdown" role="timer" aria-live="off" aria-label={`Time left ${fmt(remaining)}`} data-testid="text-countdown"><Timer size={13} /> {fmt(remaining)}<small>left</small></span>
            <span className="clock-bar" aria-hidden="true"><span style={{ transform: `scaleX(${Math.max(0, Math.min(1, remaining / (minutes * 60000)))})` }} /></span>
            {low && <span className="sr-only" role="status">{critical ? 'Less than one minute left' : 'Less than five minutes left'}</span>}
          </div>
        </div>
        {header}

        {state.section === 'A' ? (
          <div data-testid="section-a">
            <h4 className="section-title">SECTION A · OBJECTIVE <span>Answer all questions</span></h4>
            <div className="q-dots" role="navigation" aria-label="Questions">
              {questions.map((_, i) => <button key={i} type="button" className={`q-dot${i === state.current ? ' current' : ''}${state.obj[i] !== null ? ' done' : ''}`} onClick={() => set(() => ({ current: i }))} aria-label={`Question ${i + 1}`} data-testid={`button-exam-q-${i}`}>{i + 1}</button>)}
            </div>
            <h3 className="quiz-prompt">{state.current + 1}. <SubjectPrompt text={clean(q.prompt)} /></h3>
            <div className="choices">
              {q.choices.map((c, i) => <button key={i} type="button" className={`choice${state.obj[state.current] === i ? ' selected' : ''}`} onClick={() => set((s) => ({ obj: s.obj.map((a, j) => (j === s.current ? i : a)) }))} data-testid={`button-exam-choice-${i}`}><span className="choice-letter">{L(i)}</span><span>{clean(c)}</span></button>)}
            </div>
            <div className="quiz-actions split">
              <button className="quiet-button" type="button" disabled={state.current === 0} onClick={() => set((s) => ({ current: s.current - 1 }))} data-testid="button-exam-prev"><ChevronLeft size={13} /> Previous</button>
              {state.current === questions.length - 1
                ? <button className="quiet-button" type="button" onClick={() => set(() => ({ section: 'B' }))} data-testid="button-goto-section-b">Go to Section B <ChevronRight size={13} /></button>
                : <button className="quiet-button" type="button" onClick={() => set((s) => ({ current: s.current + 1 }))} data-testid="button-exam-next">Next <ChevronRight size={13} /></button>}
            </div>
          </div>
        ) : (
          <div data-testid="section-b">
            <h4 className="section-title">SECTION B · THEORY <span>Answer ONE from Part A and THREE from Part B</span></h4>
            {([['PART A', PART_A, 1], ['PART B', PART_B, 3]] as const).map(([name, idxs, limit]) => (
              <div key={name} className="paper-part">
                <div className="part-head"><strong>{name}</strong><span data-testid={`text-${name === 'PART A' ? 'part-a' : 'part-b'}-count`}>{name === 'PART A' ? (state.partA === null ? 0 : 1) : state.partB.length} of {limit} chosen</span></div>
                {idxs.map((qi) => {
                  const tq = theory[qi];
                  const on = name === 'PART A' ? state.partA === qi : state.partB.includes(qi);
                  const blocked = name === 'PART B' && !on && state.partB.length >= 3;
                  return (
                    <article key={qi} className={`theory-card paper-q${on ? ' chosen' : ''}`} data-testid={`card-paper-q-${qi}`}>
                      <label className={`pick-row${blocked ? ' blocked' : ''}`}>
                        <input type={name === 'PART A' ? 'radio' : 'checkbox'} name={name === 'PART A' ? `${key}-parta` : undefined} checked={on} disabled={blocked}
                          onChange={() => (name === 'PART A' ? set((s) => ({ partA: s.partA === qi ? null : qi })) : togglePartB(qi))} data-testid={`select-paper-q-${qi}`} />
                        <span>{on ? 'Answering' : blocked ? 'Limit reached' : 'Answer this question'}</span>
                      </label>
                      <h3><span className="cram-dot">{qi + 1}</span><SubjectPrompt text={clean(tq.prompt)} /></h3>
                      {tq.parts.map((p) => {
                        const k = `${qi}-${p.label}`;
                        return (
                          <div key={k} className="theory-part">
                            <label htmlFor={`paper-${k}`}><b>({p.label})</b> {clean(p.question)}</label>
                            {on && <textarea id={`paper-${k}`} className="source-textarea theory-input" value={state.written[k] ?? ''} placeholder="Write your answer..." onChange={(e) => { const v = e.target.value; set((s) => ({ written: { ...s.written, [k]: v } })); }} data-testid={`input-paper-${k}`} />}
                          </div>
                        );
                      })}
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <div className="exam-submit-bar" data-testid="bar-exam-submit">
          <span className="exam-submit-status" data-testid="text-exam-progress">{incomplete.length ? `${answered}/${questions.length} objective · ${picks.length}/4 theory chosen` : 'All sections complete'}</span>
          <button className="small-primary" type="button" onClick={() => { if (!incomplete.length || window.confirm(`Your paper is incomplete: ${incomplete.join('; ')}. Submit anyway?`)) submit(false); }} data-testid="button-submit-exam"><Send size={13} /> Submit paper</button>
        </div>
      </div>
    );
  }

  const pct = Math.round((state.score / questions.length) * 1000) / 10;
  const picks = chosen(state);
  return (
    <div className="exam-result paper" data-testid="exam-result">
      {header}
      <div className="score-card">
        <div className="score-ring" style={{ ['--pct' as string]: `${pct}%` }}><strong data-testid="text-exam-score">{state.score}/{questions.length}</strong></div>
        <div><h3>Section A: {pct}%{state.timedOut ? ' · time ran out' : ''}</h3><p>Section B is self-reviewed below against model answers. It is not scored automatically. Submitted {new Date(state.submittedAt).toLocaleString()}.</p>
          <button className="quiet-button" type="button" onClick={() => { if (window.confirm('Start a fresh attempt? This result will be cleared.')) start(); }} data-testid="button-restart-exam"><RotateCcw size={13} /> Restart paper</button></div>
      </div>
      <h4 className="section-title">SECTION B · YOUR ANSWERS</h4>
      {picks.length === 0 ? <p className="helper">No theory questions were chosen.</p> : picks.map((qi) => (
        <article key={qi} className="theory-card" data-testid={`review-theory-${qi}`}>
          <h3><span className="cram-dot">{qi + 1}</span><SubjectPrompt text={clean(theory[qi].prompt)} /></h3>
          {theory[qi].parts.map((p) => (
            <div key={p.label} className="theory-part">
              <label><b>({p.label})</b> {clean(p.question)}</label>
              <div className="your-answer"><span>Your answer</span><p>{(state.written[`${qi}-${p.label}`] ?? '').trim() || 'Not answered'}</p></div>
              <div className="model-answer"><span>Model answer</span><p>{clean(p.modelAnswer)}</p></div>
            </div>
          ))}
        </article>
      ))}
      <h4 className="section-title">SECTION A · REVIEW</h4>
      <ol className="review-list">
        {questions.map((q, i) => {
          const a = state.obj[i];
          const ok = a === q.answerIndex;
          return (
            <li key={i} className={ok ? 'good' : 'bad'} data-testid={`review-q-${i}`}>
              <strong>{i + 1}. <SubjectPrompt text={clean(q.prompt)} /></strong>
              <span>Your answer: {a === null ? 'Not answered' : `${L(a)}. ${clean(q.choices[a] ?? '')}`}</span>
              {!ok && <span>Correct: {L(q.answerIndex)}. {clean(q.choices[q.answerIndex] ?? '')}</span>}
              <p>{clean(q.explanation)}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
