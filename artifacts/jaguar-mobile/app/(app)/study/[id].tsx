import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JaguarRunner } from '@/components/Jaguar';
import { Flashcards, ObjectivePractice, TheoryTest, usePersisted } from '@/components/Practice';
import { MathText, RichNotes } from '@/components/RichText';
import { SourceViewer } from '@/components/SourceViewer';
import { TimedExam } from '@/components/TimedExam';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, Empty, IconButton, Notice, Pill, Skeleton, webBottom, webTop } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { MODE_INFO, clean, modeLabel, setModes, type StudyMode, type StudySet } from '@/lib/study';
import { userKey } from '@/lib/storage';
import { useWorkspace } from '@/lib/workspace';

export default function StudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const w = useWorkspace();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();

  // Generation lands here first, then swaps to the saved set.
  useEffect(() => {
    if (id === 'new' && w.gen.phase === 'done') { const sid = w.gen.setId; w.resetGen(); router.replace(`/study/${sid}`); }
  }, [id, w.gen, w, router]);

  if (id === 'new') {
    const g = w.gen;
    return (
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + webTop + 8, paddingHorizontal: 18, gap: 18 }}>
        <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} testID="button-back" />
        {g.phase === 'generating' && (
          <View style={{ gap: 18, paddingTop: 40 }} testID="status-generating">
            <JaguarRunner label="Building your study set" />
            <Text style={[st.body, { color: c.mutedForeground, textAlign: 'center' }]}>Preparing {g.modes.map(modeLabel).join(', ')}. Large notes can take a minute or two. You can leave this screen; it keeps going.</Text>
          </View>
        )}
        {g.phase === 'error' && (
          <Notice text={`${g.offline ? 'You appear to be offline. ' : ''}${g.message}`} testID="error-generation"
            action={<><Button small label="Try again" icon="refresh-cw" onPress={() => void w.generate()} testID="button-retry-generate" /><Button small variant="quiet" label="Change files" onPress={() => { w.resetGen(); router.back(); }} /></>} />
        )}
        {g.phase === 'unsaved' && (
          <Notice text={g.message} testID="error-unsaved" action={<Button small label="Retry saving" icon="save" onPress={() => void w.retryUnsaved()} testID="button-retry-unsaved" />} />
        )}
        {g.phase === 'idle' && <Empty icon="inbox" title="Nothing is being built" body="Pick files on the home screen to start." action={<Button small label="Home" onPress={() => router.replace('/home')} />} />}
      </View>
    );
  }

  const set = w.getSet(id);
  if (!set) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + webTop + 8, paddingHorizontal: 18, gap: 16 }}>
        <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} testID="button-back" />
        {w.query.isLoading ? <><Skeleton height={40} /><Skeleton height={300} /></>
          : <Empty icon="search" title="Study set not found" body="It may have been deleted on another device." action={<Button small label="Home" onPress={() => router.replace('/home')} />} />}
      </View>
    );
  }
  return <Reader key={set.id} set={set} />;
}

type Sub = 'notes' | 'terms' | 'cards';

function Reader({ set }: { set: StudySet }) {
  const w = useWorkspace();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const modes = setModes(set);
  const scope = (k: string) => userKey(w.userId, k, set.id);
  const [mode, setMode] = usePersisted<StudyMode>(scope('mode'), modes[0]);
  const [sub, setSub] = useState<Sub>('notes');
  const [showSource, setShowSource] = usePersisted<boolean>(scope('source-open'), false);
  const [size, setSize] = usePersisted<number>(userKey(w.userId, 'text-size'), 16);
  const [visited, setVisited] = useState<StudyMode[]>([]);
  const active = modes.includes(mode) ? mode : modes[0];
  useEffect(() => { setVisited((v) => (v.includes(active) ? v : [...v, active])); }, [active]);

  const pending = w.backups.some((b) => b.id === set.id);
  const remote = w.remoteIds.has(set.id);
  const saving = w.savingIds.has(set.id);

  const del = () => Alert.alert('Delete study set', `Delete "${clean(set.title)}"? This cannot be undone.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { if (await w.deleteSet(set)) router.replace('/home'); else Alert.alert('Could not delete', 'Check your connection and try again.'); } },
  ]);

  const panel = (m: StudyMode) => {
    switch (m) {
      case 'summary':
        return (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['notes', 'terms', 'cards'] as Sub[]).map((x) => <Pill key={x} label={x === 'notes' ? 'Notes' : x === 'terms' ? 'Key terms' : 'Flashcards'} active={sub === x} onPress={() => setSub(x)} testID={`tab-sub-${x}`} />)}
            </View>
            {sub === 'notes' && <RichNotes text={clean(set.summary)} size={size} testID="text-summary" />}
            {sub === 'terms' && (set.keyTerms.length ? set.keyTerms.map((t, i) => (
              <View key={i} style={[st.term, { borderBottomColor: c.border }]}>
                <MathText text={clean(t.term)} style={{ color: c.primary, fontFamily: 'Inter_700Bold', fontSize: size }} />
                <MathText text={clean(t.definition)} style={{ color: c.foreground, fontFamily: 'Inter_400Regular', fontSize: size - 1, lineHeight: (size - 1) * 1.5 }} />
              </View>
            )) : <Empty icon="tag" title="No key terms" />)}
            {sub === 'cards' && <Flashcards terms={set.keyTerms} mastered={set.masteredTerms ?? []} onRate={(t, ok) => w.updateMastered(set, t, ok)} />}
          </View>
        );
      case 'tutor':
        return set.tutorLesson ? <RichNotes text={clean(set.tutorLesson)} size={size} testID="text-tutor" /> : <Empty icon="award" title="No tutor lesson in this set" body="Generate again with Tutor Lesson selected." />;
      case 'cram':
        return set.cramPoints.length ? (
          <View style={{ gap: 10 }} testID="list-cram">
            {set.cramPoints.map((p, i) => (
              <View key={i} style={[st.cram, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={{ color: c.primary, fontFamily: 'Inter_700Bold', fontSize: 14, width: 26 }}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={{ flex: 1 }}><MathText text={clean(p)} style={{ color: c.foreground, fontFamily: 'Inter_500Medium', fontSize: size - 1, lineHeight: (size - 1) * 1.45 }} /></View>
              </View>
            ))}
          </View>
        ) : <Empty icon="zap" title="No cram points" />;
      case 'objective':
        return <ObjectivePractice questions={set.questions} storageKey={scope('objective')} />;
      case 'theory':
        return <TheoryTest questions={set.theoryQuestions ?? []} storageKey={scope('theory')} />;
      case 'timed':
        return <TimedExam title={set.title} questions={set.questions} theory={set.theoryQuestions ?? []} minutes={set.examMinutes ?? 60} storageKey={scope('exam-v2')} />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[st.header, { paddingTop: insets.top + webTop + 6, borderBottomColor: c.border, backgroundColor: c.background }]}>
        <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} testID="button-back" />
        <View style={{ flex: 1 }}>
          <Text style={[st.title, { color: c.foreground }]} numberOfLines={1} testID="text-set-title">{clean(set.title)}</Text>
          <Text style={{ color: pending ? c.warn : c.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 11 }}>{pending ? (remote ? 'Unsynced changes on this phone' : 'Saved on this phone only') : 'Saved to your account'}</Text>
        </View>
        <IconButton icon="file-text" label={showSource ? 'Hide source' : 'Show source'} active={showSource} onPress={() => setShowSource(!showSource)} testID="button-toggle-source" />
        <IconButton icon="trash-2" tone="danger" label="Delete set" onPress={del} testID="button-delete-set" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {MODE_INFO.filter((m) => modes.includes(m.id)).map((m) => (
          <Pill key={m.id} label={m.short} icon={m.icon as never} active={active === m.id} onPress={() => setMode(m.id)} testID={`tab-mode-${m.id}`} />
        ))}
      </ScrollView>
      <KeyboardAwareScrollViewCompat bottomOffset={24} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + webBottom + 48, gap: 16 }} keyboardShouldPersistTaps="handled">
        {pending && (
          <Notice tone="warn" text="This set is not in your account yet, so it will not appear on your other devices." testID="notice-unsynced"
            action={<Button small label="Save to account" icon="upload-cloud" busy={saving} onPress={() => void w.retrySave(set).then((ok) => { if (!ok) Alert.alert('Still not saved', 'It stays on this phone. Retry when you are online.'); })} testID="button-sync-set" />} />
        )}
        <SourceViewer userId={w.userId} setId={set.id} sourceText={set.sourceText} sourceName={set.sourceName} expanded={showSource} onClose={() => setShowSource(false)} />
        {(active === 'summary' || active === 'tutor' || active === 'cram') && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end' }}>
            <Pressable onPress={() => setSize(Math.max(13, size - 1))} accessibilityLabel="Smaller text" style={[st.sz, { borderColor: c.border }]} testID="button-text-smaller"><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>A-</Text></Pressable>
            <Pressable onPress={() => setSize(Math.min(22, size + 1))} accessibilityLabel="Larger text" style={[st.sz, { borderColor: c.border }]} testID="button-text-larger"><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>A+</Text></Pressable>
          </View>
        )}
        {/* Visited modes stay mounted so in-progress work survives switching. */}
        {visited.filter((m) => modes.includes(m)).map((m) => (
          <View key={m} style={{ display: m === active ? 'flex' : 'none' }}>{panel(m)}</View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.7 }}>
          <Feather name="info" size={12} color={c.faint} />
          <Text style={{ color: c.faint, fontFamily: 'Inter_400Regular', fontSize: 11, flex: 1 }}>Generated from your notes. Check anything important against your teacher's material.</Text>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  term: { gap: 4, paddingVertical: 12, borderBottomWidth: 1 },
  cram: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  sz: { borderWidth: 1, borderRadius: 10, minWidth: 40, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
});
