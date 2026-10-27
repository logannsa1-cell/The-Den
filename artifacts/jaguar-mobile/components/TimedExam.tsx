import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MathText, SubjectPrompt } from '@/components/RichText';
import { AnswerBox, Choice, usePersisted, styles as ps } from '@/components/Practice';
import { Button, Card, Empty, Notice, tap } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { L, clean, type StudyQuestion, type TheoryQuestion } from '@/lib/study';

type Answers = { obj: (number | null)[]; partA: number | null; partB: number[]; written: Record<string, string> };
type ExamState =
  | { status: 'idle' }
  | ({ status: 'running'; deadline: number; section: 'A' | 'B'; current: number } & Answers)
  | ({ status: 'done'; score: number; submittedAt: number; timedOut: boolean } & Answers);

const PART_A = [0, 1];
const PART_B = [2, 3, 4, 5, 6];
function fmt(ms: number) { const s = Math.ceil(ms / 1000); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
const chosen = (a: Answers) => [...(a.partA === null ? [] : [a.partA]), ...a.partB].sort((x, y) => x - y);

export function TimedExam({ title, questions, theory, minutes, storageKey }: { title: string; questions: StudyQuestion[]; theory: TheoryQuestion[]; minutes: number; storageKey: string }) {
  const c = useColors();
  const validDraft = (value: unknown) => {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    if (v.status === 'idle') return true;
    if (v.status !== 'running' && v.status !== 'done') return false;
    if (!Array.isArray(v.obj) || v.obj.length !== questions.length ||
        !v.obj.every((a, i) => a === null || (Number.isInteger(a) && a >= 0 && a < questions[i].choices.length)) ||
        !(v.partA === null || v.partA === 0 || v.partA === 1) ||
        !Array.isArray(v.partB) || v.partB.length > 3 || new Set(v.partB).size !== v.partB.length ||
        !v.partB.every(a => PART_B.includes(a)) ||
        !v.written || typeof v.written !== 'object' || Array.isArray(v.written) ||
        !Object.values(v.written).every(a => typeof a === 'string')) return false;
    return v.status === 'running'
      ? typeof v.deadline === 'number' && Number.isFinite(v.deadline) && v.deadline > 0 &&
        (v.section === 'A' || v.section === 'B') && typeof v.current === 'number' &&
        Number.isInteger(v.current) && v.current >= 0 && v.current < questions.length
      : typeof v.score === 'number' && Number.isInteger(v.score) && v.score >= 0 && v.score <= questions.length &&
        typeof v.submittedAt === 'number' && Number.isFinite(v.submittedAt) && typeof v.timedOut === 'boolean';
  };
  const [state, setState, loaded] = usePersisted<ExamState>(storageKey, { status: 'idle' }, validDraft);
  const [now, setNow] = useState(() => Date.now());
  const submitted = useRef(false);
  useEffect(() => { if (loaded) submitted.current = state.status === 'done'; }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback((timedOut: boolean) => {
    if (submitted.current) return;
    submitted.current = true;
    setState((s) => {
      if (s.status !== 'running') return s;
      const score = s.obj.reduce<number>((n, a, i) => n + (a === questions[i]?.answerIndex ? 1 : 0), 0);
      return { status: 'done', obj: s.obj, partA: s.partA, partB: s.partB, written: s.written, score, submittedAt: Date.now(), timedOut };
    });
  }, [questions, setState]);

  const running = state.status === 'running';
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    // The deadline is absolute: returning from background re-reads the clock immediately.
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setNow(Date.now()); });
    return () => { clearInterval(t); sub.remove(); };
  }, [running]);
  const remaining = state.status === 'running' ? Math.max(0, state.deadline - now) : 0;
  useEffect(() => { if (loaded && state.status === 'running' && remaining <= 0) submit(true); }, [loaded, state.status, remaining, submit]);

  const start = () => {
    submitted.current = false;
    setNow(Date.now());
    setState({ status: 'running', deadline: Date.now() + minutes * 60000, section: 'A', current: 0, obj: questions.map(() => null), partA: null, partB: [], written: {} });
  };

  if (!loaded) return null;
  if (theory.length !== 7) {
    return (
      <View testID="text-exam-compat">
        <Empty icon="alert-circle" title="This set uses an older exam format" body={`The school paper needs 7 theory questions (2 in Part A, 5 in Part B). This set has ${theory.length}. Build a new set with Time based exam selected to sit the full paper. Your Objective and Theory modes still work.`} />
      </View>
    );
  }

  if (state.status === 'idle') {
    return (
      <Card style={{ gap: 14 }} testID="exam-intro">
        <Text style={[st.paperTitle, { color: c.foreground }]}>{clean(title)}</Text>
        <Text style={[st.big, { color: c.primary }]}>{minutes} min</Text>
        <Rule n="A" text={`SECTION A · OBJECTIVE. ${questions.length} questions. Choose one option A to E.`} />
        <Rule n="B" text="SECTION B · THEORY. Answer ONE question from Part A and THREE from Part B. Write your answers in full." />
        <Rule n="!" text="The clock keeps running if you leave the app or close it. The paper submits itself when time is up." />
        <Button label="Start the paper" icon="play" onPress={start} testID="button-start-exam" />
      </Card>
    );
  }

  if (state.status === 'done') {
    const pct = questions.length ? Math.round((state.score / questions.length) * 1000) / 10 : 0;
    return (
      <View style={{ gap: 16 }} testID="exam-review">
        <Card style={{ gap: 8 }}>
          <Text style={[ps.eyebrow, { color: c.primary }]}>{state.timedOut ? "TIME'S UP · SUBMITTED AUTOMATICALLY" : 'SUBMITTED'}</Text>
          <Text style={[st.big, { color: c.foreground }]} testID="text-exam-score">{state.score} / {questions.length}</Text>
          <Text style={[ps.meta, { color: c.mutedForeground, fontSize: 13 }]}>Section A {pct}% · Section B is self-marked against the model answers below.</Text>
          <Button label="Sit it again" icon="rotate-ccw" variant="quiet" onPress={() => Alert.alert('Start again?', 'Your answers and score for this paper will be cleared.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Start again', style: 'destructive', onPress: () => { submitted.current = false; setState({ status: 'idle' }); } }])} testID="button-restart-exam" />
        </Card>
        <Text style={[st.section, { color: c.foreground }]}>Section A review</Text>
        {questions.map((q, i) => {
          const a = state.obj[i];
          const ok = a === q.answerIndex;
          return (
            <View key={i} style={[st.review, { borderColor: ok ? c.good : c.destructive, backgroundColor: c.card }]}>
              <SubjectPrompt text={`${i + 1}. ${clean(q.prompt)}`} style={ps.prompt(c.foreground)} />
              <Text style={{ color: ok ? c.good : c.destructive, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
                {a === null || a === undefined ? 'Not answered' : `Your answer ${L(a)}`} · Correct {L(q.answerIndex)}
              </Text>
              <MathText text={clean(q.explanation)} style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }} />
            </View>
          );
        })}
        <Text style={[st.section, { color: c.foreground }]}>Section B review</Text>
        {chosen(state).length === 0 && <Notice tone="warn" text="No theory questions were chosen in Section B." />}
        {chosen(state).map((qi) => (
          <View key={qi} style={[st.review, { borderColor: c.border, backgroundColor: c.card }]}>
            <SubjectPrompt text={`Question ${qi + 1}. ${clean(theory[qi].prompt)}`} style={ps.prompt(c.foreground)} />
            {theory[qi].parts.map((p) => (
              <View key={p.label} style={{ gap: 6 }}>
                <MathText text={`(${p.label}) ${clean(p.question)}`} style={{ color: c.foreground, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 }} />
                <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>Your answer: {state.written[`${qi}-${p.label}`]?.trim() || 'Not written'}</Text>
                <View style={[ps.model, { borderColor: c.primary, backgroundColor: c.primarySoft }]}>
                  <Text style={[ps.eyebrow, { color: c.primary }]}>MODEL ANSWER</Text>
                  <MathText text={clean(p.modelAnswer)} style={{ color: c.foreground, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  const s = state;
  const answeredA = s.obj.filter((a) => a !== null).length;
  const low = remaining < 5 * 60000;
  const update = (patch: Partial<typeof s>) => setState((prev) => (prev.status === 'running' ? { ...prev, ...patch } : prev));
  const togglePart = (qi: number) => {
    tap();
    if (PART_A.includes(qi)) update({ partA: s.partA === qi ? null : qi });
    else if (s.partB.includes(qi)) update({ partB: s.partB.filter((x) => x !== qi) });
    else if (s.partB.length < 3) update({ partB: [...s.partB, qi] });
    else Alert.alert('Three already chosen', 'Unselect a Part B question first.');
  };
  const confirmSubmit = () => {
    const incomplete: string[] = [];
    if (answeredA < questions.length) incomplete.push(`${questions.length - answeredA} objective unanswered`);
    if (s.partA === null) incomplete.push('no Part A question chosen');
    if (s.partB.length < 3) incomplete.push(`${3 - s.partB.length} Part B ${3 - s.partB.length === 1 ? 'question' : 'questions'} not chosen`);
    Alert.alert('Submit the paper?', incomplete.length ? `Still open: ${incomplete.join(', ')}.` : 'You cannot change answers after submitting.', [
      { text: 'Keep writing', style: 'cancel' }, { text: 'Submit', style: 'destructive', onPress: () => submit(false) },
    ]);
  };
  const q = questions[s.current];

  return (
    <View style={{ gap: 14 }} testID="exam-running">
      <View style={[st.clock, { backgroundColor: low ? c.destructiveSoft : c.card, borderColor: low ? c.destructive : c.border }]}>
        <Feather name="clock" size={18} color={low ? c.destructive : c.primary} />
        <Text style={[st.time, { color: low ? c.destructive : c.foreground }]} testID="text-exam-timer" accessibilityLiveRegion="polite">{fmt(remaining)}</Text>
        <View style={{ flex: 1 }} />
        <Button small label="Submit" icon="send" onPress={confirmSubmit} testID="button-submit-exam" />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['A', 'B'] as const).map((sec) => (
          <Pressable key={sec} onPress={() => { tap(); update({ section: sec }); }} accessibilityRole="tab" accessibilityState={{ selected: s.section === sec }} testID={`tab-section-${sec}`}
            style={[st.secTab, { backgroundColor: s.section === sec ? c.primary : c.card, borderColor: s.section === sec ? c.primary : c.border }]}>
            <Text style={{ color: s.section === sec ? c.primaryForeground : c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
              {sec === 'A' ? `Section A · ${answeredA}/${questions.length}` : `Section B · ${chosen(s).length}/4`}
            </Text>
          </Pressable>
        ))}
      </View>

      {s.section === 'A' ? (
        !q ? <Empty icon="list" title="No objective questions" body="Go to Section B." /> : (
          <View style={{ gap: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {questions.map((_, i) => (
                <Pressable key={i} onPress={() => update({ current: i })} accessibilityLabel={`Question ${i + 1}`} testID={`button-exam-q-${i}`}
                  style={[st.dot, { borderColor: i === s.current ? c.primary : c.border, backgroundColor: s.obj[i] !== null ? c.primarySoft : c.card }]}>
                  <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{i + 1}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <SubjectPrompt text={`${s.current + 1}. ${clean(q.prompt)}`} style={ps.prompt(c.foreground)} />
            {q.choices.map((ch, i) => (
              <Choice key={i} index={i} text={ch} state={s.obj[s.current] === i ? 'selected' : undefined} testID={`exam-choice-${i}`}
                onPress={() => update({ obj: s.obj.map((a, j) => (j === s.current ? i : a)) })} />
            ))}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Back" icon="chevron-left" variant="quiet" disabled={s.current === 0} onPress={() => update({ current: s.current - 1 })} style={{ flex: 1 }} />
              {s.current < questions.length - 1
                ? <Button label="Next" icon="chevron-right" onPress={() => update({ current: s.current + 1 })} style={{ flex: 1 }} testID="button-exam-next" />
                : <Button label="Section B" icon="arrow-right" onPress={() => update({ section: 'B' })} style={{ flex: 1 }} testID="button-to-section-b" />}
            </View>
          </View>
        )
      ) : (
        <View style={{ gap: 14 }}>
          <Text style={[ps.meta, { color: c.mutedForeground, fontSize: 13 }]}>Answer ONE from Part A and THREE from Part B. Tap a question to choose it.</Text>
          {[{ label: 'Part A · choose one', idx: PART_A }, { label: `Part B · choose three (${s.partB.length}/3)`, idx: PART_B }].map((part) => (
            <View key={part.label} style={{ gap: 10 }}>
              <Text style={[st.section, { color: c.foreground }]}>{part.label}</Text>
              {part.idx.map((qi) => {
                const on = s.partA === qi || s.partB.includes(qi);
                return (
                  <View key={qi} style={[st.review, { borderColor: on ? c.primary : c.border, backgroundColor: c.card }]}>
                    <Pressable onPress={() => togglePart(qi)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID={`button-choose-theory-${qi}`} style={{ flexDirection: 'row', gap: 10 }}>
                      <Feather name={on ? 'check-square' : 'square'} size={20} color={on ? c.primary : c.mutedForeground} />
                      <View style={{ flex: 1 }}><SubjectPrompt text={`Question ${qi + 1}. ${clean(theory[qi].prompt)}`} style={ps.prompt(c.foreground)} /></View>
                    </Pressable>
                    {on && theory[qi].parts.map((p) => (
                      <View key={p.label} style={{ gap: 6 }}>
                        <MathText text={`(${p.label}) ${clean(p.question)}`} style={{ color: c.foreground, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 }} />
                        <AnswerBox value={s.written[`${qi}-${p.label}`] ?? ''} onChange={(v) => update({ written: { ...s.written, [`${qi}-${p.label}`]: v } })} testID={`input-exam-${qi}-${p.label}`} />
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Rule({ n, text }: { n: string; text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={[st.rule, { backgroundColor: c.primarySoft }]}><Text style={{ color: c.primary, fontFamily: 'Inter_700Bold', fontSize: 13 }}>{n}</Text></View>
      <Text style={{ flex: 1, color: c.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  paperTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  big: { fontFamily: 'Inter_700Bold', fontSize: 40, letterSpacing: -1 },
  section: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  review: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 10, paddingLeft: 14 },
  time: { fontFamily: 'Inter_700Bold', fontSize: 24, fontVariant: ['tabular-nums'] },
  secTab: { flex: 1, borderWidth: 1, borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rule: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
