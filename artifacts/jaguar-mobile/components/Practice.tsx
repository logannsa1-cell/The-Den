import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { MathText, SubjectPrompt } from '@/components/RichText';
import { Button, Empty, tap } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { L, clean, type StudyQuestion, type StudyTerm, type TheoryQuestion } from '@/lib/study';
import { writeJson } from '@/lib/storage';

/** Loads a persisted value, writes back on every change once loaded. */
export function usePersisted<T>(key: string, initial: T, validate?: (value: unknown) => boolean): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const initialRef = useRef(initial);
  const valueRef = useRef(initial);
  const validator = useRef(validate); validator.current = validate;
  const writes = useRef(Promise.resolve());
  const warned = useRef(false);
  const ready = useRef(false);
  useEffect(() => {
    let alive = true;
    ready.current = false;
    setLoaded(false);
    const shapeMatches = (v: unknown, template: unknown): boolean => {
      if (template === null) return v === null;
      if (Array.isArray(template)) return Array.isArray(v);
      if (typeof template === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v) &&
        Object.entries(template as object).every(([k, t]) => shapeMatches((v as Record<string, unknown>)[k], t));
      return typeof v === typeof template && (typeof v !== 'number' || Number.isFinite(v));
    };
    AsyncStorage.getItem(key).then((raw) => {
      const v: T = raw === null ? initialRef.current : JSON.parse(raw);
      if (!(validator.current ? validator.current(v) : shapeMatches(v, initialRef.current))) throw new Error('Invalid draft');
      if (alive) { valueRef.current = v; setValue(v); }
    }).catch(() => {
      if (alive) {
        valueRef.current = initialRef.current;
        setValue(initialRef.current);
        Alert.alert('Saved progress could not be read', 'The existing stored draft has not been overwritten. Starting new work will replace it. Check your device storage before continuing.');
      }
    }).finally(() => { if (alive) { ready.current = true; setLoaded(true); } });
    return () => { alive = false; };
  }, [key]);
  const update: React.Dispatch<React.SetStateAction<T>> = React.useCallback((action) => {
    if (!ready.current) return;
    const next = typeof action === 'function' ? (action as (v: T) => T)(valueRef.current) : action;
    valueRef.current = next;
    setValue(next);
    // Queue writes immediately, not in an effect after paint. Keep their order across rapid typing/unmounts.
    writes.current = writes.current.then(async () => {
      const ok = await writeJson(key, next);
      if (!ok && !warned.current) {
        warned.current = true;
        Alert.alert('Answers are not saved', 'Your latest answers are only in memory. Keep this screen open and free device storage before continuing.');
      }
      if (ok) warned.current = false;
    });
  }, [key]);
  return [value, update, loaded];
}

export function Choice({ index, text, state, onPress, disabled, testID }: { index: number; text: string; state?: 'selected' | 'correct' | 'wrong'; onPress: () => void; disabled?: boolean; testID?: string }) {
  const c = useColors();
  const col = state === 'correct' ? c.good : state === 'wrong' ? c.destructive : state === 'selected' ? c.primary : c.border;
  return (
    <Pressable disabled={disabled} onPress={() => { tap(); onPress(); }} accessibilityRole="radio" accessibilityState={{ selected: state === 'selected', disabled: !!disabled }} testID={testID}
      style={({ pressed }) => [styles.choice, { borderColor: col, backgroundColor: state ? `${col}1a` : c.card, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.letter, { backgroundColor: state ? col : c.cardRaised }]}>
        <Text style={{ color: state ? c.background : c.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{L(index)}</Text>
      </View>
      <View style={{ flex: 1 }}><MathText text={clean(text)} style={{ color: c.foreground, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 }} /></View>
      {state === 'correct' && <Feather name="check" size={18} color={c.good} />}
      {state === 'wrong' && <Feather name="x" size={18} color={c.destructive} />}
    </Pressable>
  );
}

export function ObjectivePractice({ questions, storageKey }: { questions: StudyQuestion[]; storageKey: string }) {
  const c = useColors();
  const [st, setSt, loaded] = usePersisted<{ index: number; picked: Record<number, number> }>(storageKey, { index: 0, picked: {} });
  if (!questions.length) return <Empty icon="list" title="No objective questions in this set" body="Generate again with Objective selected." />;
  if (!loaded) return null;
  const index = Math.max(0, Math.min(Math.floor(st.index), questions.length - 1));
  const q = questions[index];
  const chosen = st.picked[index];
  const answered = chosen !== undefined;
  const tried = Object.keys(st.picked).length;
  const correct = Object.entries(st.picked).filter(([i, a]) => questions[Number(i)]?.answerIndex === a).length;
  return (
    <View style={{ gap: 14 }} testID="objective-practice">
      <View style={styles.row}>
        <Text style={[styles.meta, { color: c.mutedForeground }]}>{correct} correct of {tried} tried</Text>
        <Text style={[styles.meta, { color: c.mutedForeground }]}>{index + 1} / {questions.length}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.cardRaised }]}><View style={{ width: `${((index + 1) / questions.length) * 100}%`, height: '100%', backgroundColor: c.primary }} /></View>
      <SubjectPrompt text={clean(q.prompt)} style={styles.prompt(c.foreground)} />
      <View style={{ gap: 10 }}>
        {q.choices.map((ch, i) => (
          <Choice key={i} index={i} text={ch} disabled={answered} testID={`choice-${i}`}
            state={answered ? (i === q.answerIndex ? 'correct' : i === chosen ? 'wrong' : undefined) : undefined}
            onPress={() => setSt((s) => ({ ...s, picked: { ...s.picked, [index]: i } }))} />
        ))}
      </View>
      {answered && (
        <View style={[styles.feedback, { borderColor: chosen === q.answerIndex ? c.good : c.destructive, backgroundColor: c.card }]} testID="quiz-feedback">
          <Text style={{ color: chosen === q.answerIndex ? c.good : c.destructive, fontFamily: 'Inter_700Bold', fontSize: 15 }}>{chosen === q.answerIndex ? 'Correct.' : `Answer is ${L(q.answerIndex)}.`}</Text>
          <MathText text={clean(q.explanation)} style={{ color: c.foreground, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }} />
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Back" icon="chevron-left" variant="quiet" disabled={index === 0} onPress={() => setSt((s) => ({ ...s, index: index - 1 }))} style={{ flex: 1 }} testID="button-prev-question" />
        {index < questions.length - 1
          ? <Button label="Next" icon="chevron-right" onPress={() => setSt((s) => ({ ...s, index: index + 1 }))} style={{ flex: 1 }} testID="button-next-question" />
          : <Button label="Again" icon="rotate-ccw" onPress={() => setSt({ index: 0, picked: {} })} style={{ flex: 1 }} testID="button-restart-quiz" />}
      </View>
    </View>
  );
}

export function Flashcards({ terms, mastered, onRate }: { terms: StudyTerm[]; mastered: string[]; onRate: (term: string, ok: boolean) => void }) {
  const c = useColors();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const term = terms[index % Math.max(1, terms.length)];
  if (!term) return <Empty icon="layers" title="No flashcards" body="This set has no key terms." />;
  const rate = (ok: boolean) => { onRate(term.term, ok); setIndex((i) => (i + 1) % terms.length); setFlipped(false); };
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.row}>
        <Text style={[styles.meta, { color: c.mutedForeground }]}>Card {index + 1} of {terms.length}</Text>
        <Text style={[styles.meta, { color: c.mutedForeground }]}>{mastered.length} mastered</Text>
      </View>
      <Pressable onPress={() => { tap(); setFlipped((f) => !f); }} accessibilityRole="button" testID="button-flip-flashcard"
        style={[styles.flash, { backgroundColor: flipped ? c.primarySoft : c.card, borderColor: flipped ? c.primary : c.border }]}>
        <Text style={[styles.eyebrow, { color: c.primary }]}>{flipped ? 'DEFINITION' : 'TERM'}</Text>
        <MathText text={clean(flipped ? term.definition : term.term)} style={{ color: c.foreground, fontFamily: flipped ? 'Inter_400Regular' : 'Inter_700Bold', fontSize: flipped ? 17 : 24, lineHeight: flipped ? 25 : 30, textAlign: 'center' }} />
        <Text style={[styles.meta, { color: c.faint }]}>{flipped ? 'Tap to see the term' : 'Recall it, then tap'}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Still learning" variant="quiet" disabled={!flipped} onPress={() => rate(false)} style={{ flex: 1 }} testID="button-flashcard-again" />
        <Button label="Got it" icon="check" disabled={!flipped} onPress={() => rate(true)} style={{ flex: 1 }} testID="button-flashcard-mastered" />
      </View>
    </View>
  );
}

type Draft = { answers: Record<string, string>; revealed: Record<string, boolean>; marks: Record<string, 'got' | 'partly' | 'missed'> };

export function TheoryTest({ questions, storageKey }: { questions: TheoryQuestion[]; storageKey: string }) {
  const c = useColors();
  const [d, setD, loaded] = usePersisted<Draft>(storageKey, { answers: {}, revealed: {}, marks: {} });
  if (!questions.length) return <Empty icon="edit-3" title="No theory questions in this set" body="Generate again with Theory selected." />;
  if (!loaded) return null;
  const marks = Object.values(d.marks);
  return (
    <View style={{ gap: 16 }} testID="theory-test">
      <Text style={[styles.meta, { color: c.mutedForeground, fontSize: 13 }]}>Write each part, then reveal the model answer and mark yourself honestly. Drafts save on this phone as you type.</Text>
      {marks.length > 0 && <Text style={[styles.meta, { color: c.primary, fontSize: 13 }]} testID="text-self-tally">Self review: {marks.filter((m) => m === 'got').length} got it · {marks.filter((m) => m === 'partly').length} partly · {marks.filter((m) => m === 'missed').length} missed</Text>}
      {questions.map((q, qi) => {
        const shown = !!d.revealed[qi];
        return (
          <View key={qi} style={[styles.theory, { backgroundColor: c.card, borderColor: c.border }]} testID={`card-theory-${qi}`}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={[styles.num, { color: c.primary }]}>{String(qi + 1).padStart(2, '0')}</Text>
              <View style={{ flex: 1 }}><SubjectPrompt text={clean(q.prompt)} style={styles.prompt(c.foreground)} /></View>
            </View>
            {q.parts.map((p) => {
              const k = `${qi}-${p.label}`;
              return (
                <View key={k} style={{ gap: 8 }}>
                  <MathText text={`(${p.label}) ${clean(p.question)}`} style={{ color: c.foreground, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 }} />
                  <AnswerBox value={d.answers[k] ?? ''} onChange={(v) => setD((x) => ({ ...x, answers: { ...x.answers, [k]: v } }))} testID={`input-theory-${k}`} />
                  {shown && (
                    <View style={[styles.model, { borderColor: c.primary, backgroundColor: c.primarySoft }]}>
                      <Text style={[styles.eyebrow, { color: c.primary }]}>MODEL ANSWER</Text>
                      <MathText text={clean(p.modelAnswer)} style={{ color: c.foreground, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 }} />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(['got', 'partly', 'missed'] as const).map((m) => {
                          const on = d.marks[k] === m;
                          const col = m === 'got' ? c.good : m === 'partly' ? c.warn : c.destructive;
                          return (
                            <Pressable key={m} onPress={() => { tap(); setD((x) => ({ ...x, marks: { ...x.marks, [k]: m } })); }} accessibilityRole="button" accessibilityState={{ selected: on }} testID={`button-mark-${m}-${k}`}
                              style={[styles.mark, { borderColor: col, backgroundColor: on ? col : 'transparent' }]}>
                              <Text style={{ color: on ? c.background : col, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{m === 'got' ? 'Got it' : m === 'partly' ? 'Partly' : 'Missed'}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
            <Button small variant="quiet" icon={shown ? 'eye-off' : 'eye'} label={shown ? 'Hide model answers' : 'Reveal model answers'} onPress={() => setD((x) => ({ ...x, revealed: { ...x.revealed, [qi]: !shown } }))} testID={`button-reveal-theory-${qi}`} />
          </View>
        );
      })}
    </View>
  );
}

export function AnswerBox({ value, onChange, testID, placeholder = 'Write your answer...' }: { value: string; onChange: (v: string) => void; testID?: string; placeholder?: string }) {
  const c = useColors();
  return (
    <TextInput multiline value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.faint} textAlignVertical="top" testID={testID}
      style={{ minHeight: 96, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, color: c.foreground, backgroundColor: c.backgroundAlt, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 }} />
  );
}

export const styles = {
  ...StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    meta: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
    track: { height: 4, borderRadius: 2, overflow: 'hidden' },
    choice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 54 },
    letter: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    feedback: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
    flash: { minHeight: 260, borderWidth: 1, borderRadius: 22, padding: 22, alignItems: 'center', justifyContent: 'center', gap: 14 },
    eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.3 },
    theory: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
    num: { fontFamily: 'Inter_700Bold', fontSize: 15, paddingTop: 2 },
    model: { borderLeftWidth: 3, borderRadius: 10, padding: 12, gap: 8 },
    mark: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  }),
  prompt: (color: string) => ({ color, fontFamily: 'Inter_600SemiBold' as const, fontSize: 17, lineHeight: 25 }),
};
