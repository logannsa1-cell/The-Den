import { SubjectPrompt } from './SubjectPrompt';
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { KeyTerm, StudyQuestion } from '@/study';

const L = (i: number) => String.fromCharCode(65 + i);

export function ObjectivePractice({ questions, clean, setId }: { questions: StudyQuestion[]; clean: (s: string) => string; setId: string }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  useEffect(() => { setIndex(0); setPicked({}); }, [setId]);
  const q = questions[index];
  if (!q) return <div className="empty-state"><strong>No objective questions yet</strong><p>Generate with Objective Questions selected.</p></div>;
  const chosen = picked[index];
  const answered = chosen !== undefined;
  const correct = Object.entries(picked).filter(([i, a]) => questions[Number(i)]?.answerIndex === a).length;
  return (
    <div className="quiz-card" data-testid="objective-practice">
      <div className="quiz-top"><span>{correct} correct of {Object.keys(picked).length} tried</span><span>{index + 1} / {questions.length}</span></div>
      <div className="quiz-progress"><span style={{ transform: `scaleX(${(index + 1) / questions.length})` }} /></div>
      <h3 className="quiz-prompt"><SubjectPrompt text={clean(q.prompt)} /></h3>
      <div className="choices">
        {q.choices.map((c, i) => {
          const st = answered && i === q.answerIndex ? ' correct' : answered && i === chosen ? ' incorrect' : '';
          return <button key={i} type="button" className={`choice${st}`} disabled={answered} onClick={() => setPicked((p) => ({ ...p, [index]: i }))} data-testid={`choice-${i}`}><span className="choice-letter">{L(i)}</span><span>{clean(c)}</span></button>;
        })}
      </div>
      {answered && <div className={`feedback ${chosen === q.answerIndex ? 'good' : 'bad'}`} role="status" data-testid="quiz-feedback"><strong>{chosen === q.answerIndex ? 'Correct.' : `Answer is ${L(q.answerIndex)}.`}</strong> {clean(q.explanation)}</div>}
      <div className="quiz-actions split">
        <button className="quiet-button" type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} data-testid="button-prev-question"><ChevronLeft size={13} /> Back</button>
        {index < questions.length - 1
          ? <button className="small-primary" type="button" onClick={() => setIndex(index + 1)} data-testid="button-next-question">Next <ChevronRight size={13} /></button>
          : <button className="small-primary" type="button" onClick={() => { setIndex(0); setPicked({}); }} data-testid="button-restart-quiz"><RotateCcw size={13} /> Practice again</button>}
      </div>
    </div>
  );
}

export function Flashcards({ terms, mastered, onRate, clean, setId }: { terms: KeyTerm[]; mastered: string[]; onRate: (term: string, ok: boolean) => void; clean: (s: string) => string; setId: string }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { setIndex(0); setFlipped(false); }, [setId]);
  const term = terms[index];
  if (!term) return <div className="empty-state"><strong>No flashcards yet</strong><p>This set has no key terms.</p></div>;
  const rate = (ok: boolean) => { onRate(term.term, ok); setIndex((i) => (i + 1) % terms.length); setFlipped(false); };
  return (
    <div className="flashcards-review">
      <div className="flashcards-status"><span>Card {index + 1} of {terms.length}</span><span>{mastered.length} mastered</span></div>
      <button className={`flashcard${flipped ? ' is-flipped' : ''}`} type="button" onClick={() => setFlipped((f) => !f)} data-testid="button-flip-flashcard">
        <span className="flashcard-label">{flipped ? 'DEFINITION' : 'TERM'}</span>
        <strong>{clean(flipped ? term.definition : term.term)}</strong>
        <span className="flashcard-hint">{flipped ? 'Tap to see the term' : 'Recall it, then tap'}</span>
      </button>
      <div className="flashcard-actions">
        <button className="flashcard-again" type="button" disabled={!flipped} onClick={() => rate(false)} data-testid="button-flashcard-again">Still learning</button>
        <button className="flashcard-mastered" type="button" disabled={!flipped} onClick={() => rate(true)} data-testid="button-flashcard-mastered"><CheckCircle2 size={14} /> Got it</button>
      </div>
    </div>
  );
}
