import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { TheoryQuestion } from '@/study';
import { readJson, writeJson } from '@/lib/source-store';

type Draft = { answers: Record<string, string>; revealed: Record<string, boolean>; marks: Record<string, 'got' | 'partly' | 'missed'> };
const EMPTY: Draft = { answers: {}, revealed: {}, marks: {} };

export function TheoryTest({ questions, storageKey, clean }: { questions: TheoryQuestion[]; storageKey: string; clean: (s: string) => string }) {
  const [draft, setDraft] = useState<Draft>(() => ({ ...EMPTY, ...readJson<Draft>(storageKey, EMPTY) }));
  useEffect(() => { writeJson(storageKey, draft); }, [storageKey, draft]);
  if (!questions.length) return <div className="empty-state"><strong>No theory questions in this set</strong><p>Generate again with Theory Test selected.</p></div>;
  const marks = Object.values(draft.marks);
  return (
    <div className="theory" data-testid="theory-test">
      <p className="helper">Write your own answer for each part. Drafts save on this device. Reveal the model answer when ready and mark yourself honestly. Nothing is graded automatically.</p>
      {marks.length > 0 && <p className="self-tally" data-testid="text-self-tally">Self review: {marks.filter((m) => m === 'got').length} got it · {marks.filter((m) => m === 'partly').length} partly · {marks.filter((m) => m === 'missed').length} missed</p>}
      {questions.map((q, qi) => {
        const shown = !!draft.revealed[qi];
        return (
          <article key={qi} className="theory-card" data-testid={`card-theory-${qi}`}>
            <h3><span className="cram-dot">{String(qi + 1).padStart(2, '0')}</span>{clean(q.prompt)}</h3>
            {q.parts.map((part) => {
              const key = `${qi}-${part.label}`;
              return (
                <div key={key} className="theory-part">
                  <label htmlFor={`theory-${key}`}><b>({part.label})</b> {clean(part.question)}</label>
                  <textarea id={`theory-${key}`} className="source-textarea theory-input" value={draft.answers[key] ?? ''} placeholder="Your answer..." onChange={(e) => setDraft((d) => ({ ...d, answers: { ...d.answers, [key]: e.target.value } }))} data-testid={`input-theory-${key}`} />
                  {shown && (
                    <div className="model-answer">
                      <span>Model answer</span><p>{clean(part.modelAnswer)}</p>
                      <div className="mark-row">
                        {(['got', 'partly', 'missed'] as const).map((m) => <button key={m} type="button" className={`mark-btn ${m}${draft.marks[key] === m ? ' on' : ''}`} onClick={() => setDraft((d) => ({ ...d, marks: { ...d.marks, [key]: m } }))} data-testid={`button-mark-${m}-${key}`}>{m === 'got' ? 'Got it' : m === 'partly' ? 'Partly' : 'Missed'}</button>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button className="quiet-button" type="button" onClick={() => setDraft((d) => ({ ...d, revealed: { ...d.revealed, [qi]: !shown } }))} data-testid={`button-reveal-theory-${qi}`}>{shown ? <><EyeOff size={13} /> Hide model answers</> : <><Eye size={13} /> Reveal model answers</>}</button>
          </article>
        );
      })}
    </div>
  );
}
