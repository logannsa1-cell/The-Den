import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePersisted } from '@/components/Practice';
import { Button, IconButton, webBottom, webTop } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { clean } from '@/lib/study';
import { keepOriginal, loadSources, previewFromSourceText, saveSources, type StoredSource } from '@/lib/sources';
import { userKey } from '@/lib/storage';

type Pos = { file: number; page: number };

/** Accessible text preview of the uploaded sources. It shows extracted text, not the original layout. */
export function SourceViewer({ userId, setId, sourceText, sourceName, expanded, onClose }: { userId: string; setId: string; sourceText: string; sourceName: string; expanded: boolean; onClose: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [local, setLocal] = useState<StoredSource[] | null>(null);
  const [pos, setPos, loaded] = usePersisted<Pos>(userKey(userId, 'source-pos', setId), { file: 0, page: 0 });
  const [big, setBig] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => { loadSources(userId, setId).then(setLocal); }, [userId, setId]);
  useEffect(reload, [reload]);

  const fallback = useMemo(() => previewFromSourceText(sourceText, sourceName), [sourceText, sourceName]);
  const files = useMemo(() => {
    if (!local) return fallback;
    if (!local.length) return fallback;
    return local.map((s, i) => ({ ...s, pages: s.pages.length ? s.pages : (fallback[i]?.pages ?? []) }));
  }, [local, fallback]);

  if (!loaded || !local) return null;
  const fi = Math.min(pos.file, files.length - 1);
  const file = files[fi];
  const pages = file?.pages ?? [];
  const pi = Math.min(pos.page, Math.max(0, pages.length - 1));

  const openOriginal = async () => {
    if (!file?.uri) return;
    if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) { Alert.alert('Not available', 'Opening files is not supported here.'); return; }
    try { await Sharing.shareAsync(file.uri, { mimeType: file.mimeType, dialogTitle: file.name }); }
    catch { Alert.alert('Could not open', 'The original file could not be opened.'); }
  };

  const reattach = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled) return;
      setBusy(true);
      const a = res.assets[0];
      const uri = await keepOriginal(userId, setId, a.uri, a.name);
      if (!uri) { Alert.alert('Could not keep file', 'The file could not be stored on this phone.'); return; }
      const base = local.length ? local : fallback.map((f) => ({ ...f, uri: null }));
      const next = base.map((s, i) => (i === fi ? { ...s, uri, mimeType: a.mimeType ?? undefined, size: a.size ?? undefined, name: s.name } : s));
      if (!(await saveSources(userId, setId, next))) Alert.alert('Not saved', 'The link to this file could not be saved.');
      reload();
    } finally { setBusy(false); }
  };

  const body = (size: number) => (
    <View style={{ gap: 10 }}>
      {files.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {files.map((f, i) => (
            <Pressable key={i} onPress={() => setPos({ file: i, page: 0 })} style={[s.fileChip, { borderColor: i === fi ? c.primary : c.border, backgroundColor: i === fi ? c.primarySoft : c.card }]} testID={`button-source-file-${i}`}>
              <Text style={{ color: c.foreground, fontFamily: 'Inter_500Medium', fontSize: 12 }} numberOfLines={1}>{f.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={[s.page, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}>
        <Text selectable style={{ color: c.foreground, fontFamily: 'Inter_400Regular', fontSize: size, lineHeight: size * 1.5 }} testID="text-source-page">{pages.length ? clean(pages[pi]) : 'No readable text for this file.'}</Text>
      </View>
      <View style={s.nav}>
        <IconButton icon="chevron-left" label="Previous page" size={40} onPress={() => setPos({ file: fi, page: Math.max(0, pi - 1) })} testID="button-source-prev" />
        <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>Page {pages.length ? pi + 1 : 0} of {pages.length}</Text>
        <IconButton icon="chevron-right" label="Next page" size={40} onPress={() => setPos({ file: fi, page: Math.min(pages.length - 1, pi + 1) })} testID="button-source-next" />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {file?.uri
          ? <Button small variant="quiet" icon="external-link" label="Open original" onPress={() => void openOriginal()} testID="button-open-original" />
          : Platform.OS !== 'web' && <Button small variant="quiet" icon="paperclip" label="Reattach original" busy={busy} onPress={() => void reattach()} testID="button-reattach" />}
      </View>
      {!file?.uri && <Text style={{ color: c.faint, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 }}>The original file is not on this phone. Originals stay on the device that uploaded them; reattach a copy to open it here.</Text>}
    </View>
  );

  if (!expanded) return null;
  return (
    <View style={[s.panel, { backgroundColor: c.card, borderColor: c.border }]} testID="panel-source">
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }} numberOfLines={1}>{file?.name ?? sourceName}</Text>
          <Text style={{ color: c.faint, fontFamily: 'Inter_400Regular', fontSize: 11 }}>Text preview, not the original layout</Text>
        </View>
        <IconButton icon="maximize-2" label="Enlarge source" size={36} onPress={() => setBig(true)} testID="button-source-enlarge" />
        <IconButton icon="eye-off" label="Hide source" size={36} onPress={onClose} testID="button-source-hide" />
      </View>
      <ScrollView style={{ maxHeight: 340 }} nestedScrollEnabled>{body(14)}</ScrollView>
      <Modal visible={big} animationType="slide" onRequestClose={() => setBig(false)}>
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + webTop }}>
          <View style={[s.head, { paddingHorizontal: 16, paddingVertical: 10 }]}>
            <Text style={{ flex: 1, color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 17 }} numberOfLines={1}>{file?.name ?? sourceName}</Text>
            <IconButton icon="minimize-2" label="Close enlarged source" onPress={() => setBig(false)} testID="button-source-shrink" />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + webBottom + 24 }}>{body(17)}</ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 18, padding: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 32, justifyContent: 'center', maxWidth: 200 },
  page: { borderWidth: 1, borderRadius: 12, padding: 14 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
