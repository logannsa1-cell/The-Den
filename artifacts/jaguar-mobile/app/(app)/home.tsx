import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Jaguar, Rosettes } from '@/components/Jaguar';
import { ModeSheet } from '@/components/ModeSheet';
import { Button, Card, Empty, Eyebrow, IconButton, Notice, Skeleton, webBottom, webTop } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { MAX_SOURCE_CHARS, clean, modeLabel, setModes, sizeLabel, type StudySet } from '@/lib/study';
import { readJson, userKey, writeJson } from '@/lib/storage';
import { useWorkspace, type SourceEntry } from '@/lib/workspace';

const PICK_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/markdown', 'text/csv', 'text/comma-separated-values', 'application/octet-stream',
];

export default function Home() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const w = useWorkspace();
  const [sheet, setSheet] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [pickError, setPickError] = useState('');
  const readyCount = useRef(0);

  // Open the mode picker each time another uploaded file finishes reading.
  useEffect(() => {
    const n = w.files.filter((f) => f.status === 'ready').length;
    const busy = w.files.some((f) => f.status === 'queued' || f.status === 'reading');
    if (n > readyCount.current && !busy) setSheet(true);
    readyCount.current = n;
  }, [w.files]);

  const pick = async () => {
    setPickError('');
    if (!w.consent) { setConsentOpen(true); return; }
    try {
      const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: Platform.OS === 'ios' ? '*/*' : PICK_TYPES });
      if (res.canceled) return;
      w.addFiles(res.assets.map((a) => ({ uri: a.uri, name: a.name, size: a.size, mimeType: a.mimeType })));
    } catch {
      setPickError('Your files could not be opened. Try choosing them again.');
    }
  };

  const startGenerate = async () => {
    setSheet(false);
    router.push('/study/new');
    await w.generate();
  };

  const confirmDelete = (set: StudySet) => {
    const remote = w.remoteIds.has(set.id);
    Alert.alert('Delete study set', `Delete "${clean(set.title)}" ${remote ? 'from your account' : 'from this device'}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { if (!(await w.deleteSet(set))) Alert.alert('Could not delete', 'Check your connection and try again.'); } },
    ]);
  };

  const ready = w.files.filter((f) => f.status === 'ready').length;
  const over = w.combinedLength > MAX_SOURCE_CHARS;
  const reading = w.files.some((f) => f.status === 'queued' || f.status === 'reading');

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={styles.spots} pointerEvents="none"><Rosettes size={240} opacity={0.09} /></View>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + webTop + 8, paddingBottom: insets.bottom + webBottom + 40, paddingHorizontal: 18, gap: 22 }}
        refreshControl={<RefreshControl refreshing={w.query.isRefetching} onRefresh={() => void w.query.refetch()} tintColor={c.primary} />}
      >
        <View style={styles.top}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Jaguar size={36} />
            <Text style={[styles.brand, { color: c.foreground }]}>Jaguar</Text>
          </View>
          <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} testID="button-settings" />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={[styles.hero, { color: c.foreground }]} testID="text-workspace-heading">Exam is soon ooo</Text>
          <Text style={[styles.sub, { color: c.mutedForeground }]}>Bring your note so you can study</Text>
        </View>

        {w.gen.phase === 'generating' || w.gen.phase === 'error' || w.gen.phase === 'unsaved' ? (
          <Notice
            tone={w.gen.phase === 'generating' ? 'info' : 'error'}
            text={w.gen.phase === 'generating' ? 'Your study set is being built.' : w.gen.phase === 'unsaved' ? w.gen.message : w.gen.message}
            action={<Button small label="Open" icon="arrow-right" variant="quiet" onPress={() => router.push('/study/new')} testID="button-open-generation" />}
          />
        ) : null}

        <Card style={{ gap: 14 }} testID="card-upload">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Bring your note</Text>
            {ready > 0 && <Button small label="Modes" icon="sliders" variant="quiet" onPress={() => setSheet(true)} testID="button-open-modes" />}
          </View>
          <Pressable onPress={() => void pick()} accessibilityRole="button" testID="button-pick-files"
            style={({ pressed }) => [styles.drop, { borderColor: c.primary, backgroundColor: c.primarySoft, opacity: pressed ? 0.8 : 1 }]}>
            <Feather name="upload" size={22} color={c.primary} />
            <Text style={[styles.dropTitle, { color: c.foreground }]}>{w.files.length ? 'Add more files' : 'Choose files'}</Text>
            <Text style={[styles.dropSub, { color: c.mutedForeground }]}>PDF, PPTX, DOCX, TXT, MD, CSV · up to 15 MB each</Text>
          </Pressable>
          {pickError ? <Notice text={pickError} /> : null}
          {w.readingIndex && (
            <View style={styles.progressRow}>
              <Text style={[styles.meta, { color: c.foreground }]} testID="text-reading-progress">Reading file {w.readingIndex.current} of {w.readingIndex.total}</Text>
              <Button small label="Cancel" variant="ghost" onPress={w.cancelReading} testID="button-cancel-reading" />
            </View>
          )}
          {w.files.map((f) => <FileRow key={f.id} f={f} onRemove={() => w.removeFile(f.id)} onRetry={() => w.retryFile(f.id)} />)}
          {w.files.length > 0 && (
            <View style={{ gap: 6 }}>
              <View style={[styles.bar, { backgroundColor: c.cardRaised }]}>
                <View style={{ height: '100%', width: `${Math.min(100, (w.combinedLength / MAX_SOURCE_CHARS) * 100)}%`, backgroundColor: over ? c.destructive : c.primary, borderRadius: 4 }} />
              </View>
              <Text style={[styles.meta, { color: over ? c.destructive : c.mutedForeground }]}>
                {w.combinedLength.toLocaleString()} of {MAX_SOURCE_CHARS.toLocaleString()} characters{over ? ' · remove a file to continue' : ''}
              </Text>
            </View>
          )}
          {w.files.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Clear" variant="quiet" onPress={w.clearFiles} style={{ flex: 1 }} testID="button-clear-files" />
              <Button label="Choose modes" icon="arrow-right" onPress={() => setSheet(true)} disabled={!ready || reading || w.gen.phase === 'generating'} style={{ flex: 2 }} testID="button-continue" />
            </View>
          )}
          <Text style={[styles.fine, { color: c.faint }]}>Files are sent briefly to Jaguar to read their text, then discarded. The text is saved in your account; the original files stay only on this phone.</Text>
        </Card>

        <ExamSchedule />

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={[styles.section, { color: c.foreground }]}>Saved sets</Text>
            {w.sets.length > 0 && <Eyebrow>{w.sets.length} saved</Eyebrow>}
          </View>
          {w.query.isLoading ? <View style={{ gap: 10 }}><Skeleton /><Skeleton /><Skeleton /></View>
            : w.query.isError && !w.sets.length ? <Notice text="Your account sets could not load." action={<Button small label="Try again" icon="refresh-cw" variant="quiet" onPress={() => void w.query.refetch()} testID="button-retry-study-sets" />} />
            : w.sets.length === 0 ? <Empty icon="bookmark" title="Nothing saved yet" body="Your first set will wait for you here, on the website too." />
            : w.sets.map((set) => (
              <SavedRow key={set.id} set={set} remote={w.remoteIds.has(set.id)} pending={w.backups.some((b) => b.id === set.id)} saving={w.savingIds.has(set.id)}
                onOpen={() => router.push(`/study/${set.id}`)} onDelete={() => confirmDelete(set)} onSync={() => void w.retrySave(set).then((ok) => { if (!ok) Alert.alert('Not saved yet', 'It is still kept on this phone. Retry when you are online.'); })} />
            ))}
          {w.query.isError && w.sets.length > 0 && <Notice tone="warn" text="Could not refresh from your account. Showing what is on this phone." />}
        </View>
      </ScrollView>

      <ModeSheet visible={sheet} onClose={() => setSheet(false)} onGenerate={() => void startGenerate()} />
      <ConsentSheet visible={consentOpen} onClose={() => setConsentOpen(false)} onAccept={() => { w.giveConsent(); setConsentOpen(false); setTimeout(() => void pick(), 350); }} />
    </View>
  );
}

function FileRow({ f, onRemove, onRetry }: { f: SourceEntry; onRemove: () => void; onRetry: () => void }) {
  const c = useColors();
  const icon = f.status === 'ready' ? 'check-circle' : f.status === 'error' || f.status === 'cancelled' ? 'alert-triangle' : 'loader';
  const col = f.status === 'ready' ? c.good : f.status === 'error' || f.status === 'cancelled' ? c.destructive : c.primary;
  return (
    <View style={[styles.file, { borderColor: c.border, backgroundColor: c.backgroundAlt }]} testID={`file-${f.id}`}>
      <Feather name={icon} size={18} color={col} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.fileName, { color: c.foreground }]} numberOfLines={1}>{f.name}</Text>
        <Text style={[styles.meta, { color: f.error ? c.destructive : c.mutedForeground }]}>
          {f.status === 'queued' ? 'Waiting' : f.status === 'reading' ? 'Reading text' : f.status === 'ready' ? `${f.text.length.toLocaleString()} characters · ${f.pages.length} ${f.pages.length === 1 ? 'page' : 'pages'}` : f.error}
          {f.size ? ` · ${sizeLabel(f.size)}` : ''}
        </Text>
        {f.notice && f.status === 'ready' ? <Text style={[styles.meta, { color: c.warn }]}>{f.notice}</Text> : null}
      </View>
      {(f.status === 'error' || f.status === 'cancelled') && !/Unsupported|15 MB/.test(f.error ?? '') && (
        <IconButton icon="refresh-cw" label={`Retry ${f.name}`} onPress={onRetry} size={38} testID={`button-retry-${f.id}`} />
      )}
      {f.status !== 'reading' && <IconButton icon="x" label={`Remove ${f.name}`} onPress={onRemove} size={38} testID={`button-remove-${f.id}`} />}
    </View>
  );
}

function SavedRow({ set, remote, pending, saving, onOpen, onDelete, onSync }: { set: StudySet; remote: boolean; pending: boolean; saving: boolean; onOpen: () => void; onDelete: () => void; onSync: () => void }) {
  const c = useColors();
  return (
    <View style={[styles.saved, { backgroundColor: c.card, borderColor: c.border }]} testID={`card-study-set-${set.id}`}>
      <Pressable onPress={onOpen} style={({ pressed }) => [{ flex: 1, gap: 6, opacity: pressed ? 0.75 : 1 }]} accessibilityRole="button" testID={`button-open-${set.id}`}>
        <Eyebrow color={pending ? c.warn : c.primary}>{pending ? (remote ? 'Unsynced changes' : 'This phone only') : 'Synced'}</Eyebrow>
        <Text style={[styles.savedTitle, { color: c.foreground }]} numberOfLines={2}>{clean(set.title) || 'Study set'}</Text>
        <Text style={[styles.meta, { color: c.mutedForeground }]}>
          {new Date(set.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {set.questions.length} questions{set.theoryQuestions?.length ? ` · ${set.theoryQuestions.length} theory` : ''}
        </Text>
        <Text style={[styles.meta, { color: c.faint }]} numberOfLines={1}>{setModes(set).map(modeLabel).join(' · ')}</Text>
      </Pressable>
      <View style={{ gap: 8 }}>
        {pending && <IconButton icon={saving ? 'loader' : 'upload-cloud'} label="Save to account" onPress={onSync} size={40} testID={`button-sync-${set.id}`} />}
        <IconButton icon="trash-2" tone="danger" label={`Delete ${clean(set.title)}`} onPress={onDelete} size={40} testID={`button-delete-${set.id}`} />
      </View>
    </View>
  );
}

function ConsentSheet({ visible, onClose, onAccept }: { visible: boolean; onClose: () => void; onAccept: () => void }) {
  const c = useColors();
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.scrim]}>
      <Card style={{ gap: 14, margin: 18 }} testID="dialog-upload-consent">
        <Feather name="shield" size={22} color={c.primary} />
        <Text style={[styles.cardTitle, { color: c.foreground }]}>Before you upload</Text>
        <Text style={[styles.body, { color: c.mutedForeground }]}>Your files are sent temporarily to Jaguar so their text can be read. The original files are not stored on the server.</Text>
        <Text style={[styles.body, { color: c.mutedForeground }]}>The extracted text is saved with your study set in your account. Original files are kept only on this phone and do not sync to other devices.</Text>
        <Text style={[styles.body, { color: c.mutedForeground }]}>Scanned or image-only pages cannot be read.</Text>
        <Button label="I understand, choose files" onPress={onAccept} testID="button-accept-consent" />
        <Button label="Not now" variant="ghost" onPress={onClose} />
      </Card>
    </View>
  );
}

type Schedule = { subject: string; date: string; pace: number };
const PACES = [0.5, 1, 1.5, 2, 3, 4];

/** Personal exam schedule. Device-local per user; never sent to generation. */
function ExamSchedule() {
  const c = useColors();
  const { userId } = useWorkspace();
  const key = userKey(userId, 'schedule');
  const [s, setS] = useState<Schedule | null>(null);
  useEffect(() => { readJson<Schedule>(key, { subject: '', date: '', pace: 1 }).then(setS); }, [key]);
  const update = (patch: Partial<Schedule>) => setS((prev) => { const next = { ...(prev ?? { subject: '', date: '', pace: 1 }), ...patch }; void writeJson(key, next); return next; });
  if (!s) return <Skeleton height={140} />;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? new Date(`${s.date}T00:00:00`) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const left = d && !Number.isNaN(d.getTime()) ? Math.round((d.getTime() - today.getTime()) / 86400000) : null;
  return (
    <Card style={{ gap: 14 }} testID="section-exam-schedule">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[styles.cardTitle, { color: c.foreground }]}>Set your pace</Text>
        <Eyebrow>On this phone</Eyebrow>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <Text style={[styles.big, { color: c.primary }]} testID="text-days-left">{left === null ? '--' : left < 0 ? 'Done' : left}</Text>
        <Text style={[styles.body, { color: c.mutedForeground, paddingBottom: 8, flex: 1 }]}>
          {left === null ? 'Add your exam date' : left < 0 ? 'That date has passed' : `${left === 1 ? 'day' : 'days'} to ${s.subject || 'your exam'} · ${Math.round(left * s.pace * 10) / 10} study hours`}
        </Text>
      </View>
      <TextInput value={s.subject} onChangeText={(v) => update({ subject: v.slice(0, 60) })} placeholder="Subject, e.g. Biology paper 2" placeholderTextColor={c.faint} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.backgroundAlt }]} testID="input-exam-subject" />
      <TextInput value={s.date} onChangeText={(v) => update({ date: v.replace(/[^\d-]/g, '').slice(0, 10) })} placeholder="Exam date YYYY-MM-DD" placeholderTextColor={c.faint} keyboardType="numbers-and-punctuation" style={[styles.input, { borderColor: s.date && left === null ? c.destructive : c.border, color: c.foreground, backgroundColor: c.backgroundAlt }]} testID="input-exam-date" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {PACES.map((p) => (
          <Pressable key={p} onPress={() => update({ pace: p })} style={[styles.paceChip, { backgroundColor: s.pace === p ? c.primary : c.backgroundAlt, borderColor: s.pace === p ? c.primary : c.border }]} accessibilityRole="button" accessibilityState={{ selected: s.pace === p }} testID={`button-pace-${p}`}>
            <Text style={{ color: s.pace === p ? c.primaryForeground : c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{p < 1 ? '30 min' : `${p} h`}/day</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  spots: { position: 'absolute', top: 60, right: -70 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.4 },
  hero: { fontFamily: 'Inter_700Bold', fontSize: 34, letterSpacing: -1, lineHeight: 38 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 16 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  section: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  drop: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 18, alignItems: 'center', paddingVertical: 24, paddingHorizontal: 12, gap: 6 },
  dropTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  dropSub: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  fileName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  bar: { height: 6, borderRadius: 4, overflow: 'hidden' },
  fine: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  saved: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  savedTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 21 },
  scrim: { backgroundColor: '#05030acc', justifyContent: 'center' },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  big: { fontFamily: 'Inter_700Bold', fontSize: 44, letterSpacing: -1.5 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, fontFamily: 'Inter_400Regular', fontSize: 15 },
  paceChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
});
