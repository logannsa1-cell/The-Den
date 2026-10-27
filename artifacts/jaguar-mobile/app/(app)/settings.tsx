import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useClerk, useUser } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Jaguar } from '@/components/Jaguar';
import { Button, Card, Eyebrow, IconButton, Notice, webBottom, webTop } from '@/components/ui';
import { THEMES, THEME_IDS } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { readJson, removeKey, userKey, writeJson } from '@/lib/storage';
import { useTheme } from '@/lib/theme';
import { useWorkspace } from '@/lib/workspace';

export default function Settings() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const { themeId, setTheme } = useTheme();
  const { userId, backups } = useWorkspace();
  const bannerKey = userKey(userId, 'banner');
  const [banner, setBanner] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'good'; text: string } | null>(null);

  useEffect(() => { readJson<string | null>(bannerKey, null).then(setBanner); }, [bannerKey]);

  const pickImage = async (aspect: [number, number]) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setMsg({ tone: 'error', text: 'Photo access is off. Allow it in your phone settings to choose a picture.' }); return null; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.8, base64: true });
    return r.canceled ? null : r.assets[0];
  };

  const changeAvatar = async () => {
    setMsg(null);
    const a = await pickImage([1, 1]);
    if (!a || !user) return;
    if (!a.base64) { setMsg({ tone: 'error', text: 'That picture could not be read.' }); return; }
    setAvatarBusy(true);
    try {
      await user.setProfileImage({ file: `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` });
      await user.reload();
      setMsg({ tone: 'good', text: 'Profile picture updated on your account.' });
    } catch {
      setMsg({ tone: 'error', text: 'Your picture could not be uploaded. Check your connection and try again.' });
    } finally { setAvatarBusy(false); }
  };

  const removeAvatar = async () => {
    if (!user) return;
    setAvatarBusy(true);
    try { await user.setProfileImage({ file: null }); await user.reload(); setMsg({ tone: 'good', text: 'Profile picture removed.' }); }
    catch { setMsg({ tone: 'error', text: 'Could not remove the picture. Try again.' }); }
    finally { setAvatarBusy(false); }
  };

  const changeBanner = async () => {
    setMsg(null);
    const a = await pickImage([3, 1]);
    if (!a) return;
    let uri = Platform.OS === 'web' && a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri;
    if (Platform.OS !== 'web') {
      try {
        const dir = new Directory(Paths.document, 'jaguar-banner', userId.replace(/[^\w-]/g, '_'));
        if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
        const dest = new File(dir, `banner-${Date.now()}.jpg`);
        await new File(a.uri).copy(dest);
        uri = dest.uri;
      } catch { setMsg({ tone: 'error', text: 'The banner could not be stored on this phone.' }); return; }
    }
    if (await writeJson(bannerKey, uri)) {
      setBanner(uri);
      if (Platform.OS !== 'web' && banner) {
        try { const old = new File(banner); if (old.exists) old.delete(); } catch { /* no longer referenced */ }
      }
    }
    else setMsg({ tone: 'error', text: 'The banner could not be saved.' });
  };

  const removeBanner = async () => { await removeKey(bannerKey); setBanner(null); };

  const doSignOut = () => {
    const warn = backups.length ? `\n\n${backups.length} ${backups.length === 1 ? 'set is' : 'sets are'} only on this phone and not in your account yet. They stay on this phone for when you sign back in.` : '';
    Alert.alert('Sign out?', `You can sign back in any time.${warn}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await qc.cancelQueries(); qc.clear(); await signOut(); router.replace('/'); } },
    ]);
  };

  const name = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Student';
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + webTop + 8, paddingBottom: insets.bottom + webBottom + 40, paddingHorizontal: 18, gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} testID="button-back" />
          <Text style={[s.h1, { color: c.foreground }]}>Settings</Text>
        </View>

        <View style={[s.profile, { backgroundColor: c.card, borderColor: c.border }]}>
          <Pressable onPress={() => void changeBanner()} accessibilityLabel="Change banner" testID="button-change-banner" style={[s.banner, { backgroundColor: c.primaryDeep }]}>
            {banner ? <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={{ position: 'absolute', right: 14, top: 14, opacity: 0.6 }}><Jaguar size={44} framed={false} /></View>}
            <View style={[s.bannerTag, { backgroundColor: `${c.background}cc` }]}><Feather name="image" size={12} color={c.foreground} /><Text style={{ color: c.foreground, fontFamily: 'Inter_500Medium', fontSize: 11 }}>Banner · this phone only</Text></View>
          </Pressable>
          <View style={{ padding: 16, paddingTop: 0, gap: 12 }}>
            <Pressable onPress={() => void changeAvatar()} accessibilityLabel="Change profile picture" testID="button-change-avatar" style={[s.avatar, { borderColor: c.card, backgroundColor: c.primary }]}>
              {user?.hasImage ? <Image source={{ uri: user.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={{ color: c.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 26 }}>{initials}</Text>}
            </Pressable>
            <View>
              <Text style={[s.name, { color: c.foreground }]} testID="text-user-name">{name}</Text>
              <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>{user?.primaryEmailAddress?.emailAddress}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button small variant="quiet" icon="camera" label="Profile picture" busy={avatarBusy} onPress={() => void changeAvatar()} testID="button-avatar" />
              {user?.hasImage && <Button small variant="ghost" label="Remove picture" onPress={() => void removeAvatar()} testID="button-remove-avatar" />}
              <Button small variant="quiet" icon="image" label="Banner" onPress={() => void changeBanner()} testID="button-banner" />
              {banner && <Button small variant="ghost" label="Remove banner" onPress={() => void removeBanner()} testID="button-remove-banner" />}
            </View>
            <Text style={{ color: c.faint, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 }}>Your profile picture is saved to your account. The banner is stored on this phone only and does not appear on the website.</Text>
          </View>
        </View>
        {msg && <Notice tone={msg.tone} text={msg.text} />}

        <Card style={{ gap: 14 }}>
          <Eyebrow>Colour</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {THEME_IDS.map((id) => {
              const p = THEMES[id].palette;
              const on = id === themeId;
              return (
                <Pressable key={id} onPress={() => setTheme(id)} accessibilityRole="radio" accessibilityState={{ selected: on }} testID={`button-theme-${id}`}
                  style={[s.swatch, { borderColor: on ? p.primary : c.border, backgroundColor: p.background }]}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <View style={[s.dot, { backgroundColor: p.primary }]} /><View style={[s.dot, { backgroundColor: p.primaryLight }]} /><View style={[s.dot, { backgroundColor: p.card }]} />
                  </View>
                  <Text style={{ color: p.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{THEMES[id].label}</Text>
                  {on && <Feather name="check" size={14} color={p.primary} style={{ position: 'absolute', top: 8, right: 8 }} />}
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: c.faint, fontFamily: 'Inter_400Regular', fontSize: 12 }}>The jaguar changes colour with you. Saved on this phone.</Text>
        </Card>

        <Card style={{ gap: 10 }}>
          <Eyebrow>About your data</Eyebrow>
          <Text style={[s.body, { color: c.mutedForeground }]}>Study sets and their extracted text live in your Jaguar account and sync with the website. Original files, drafts, exam progress, your exam date and the banner stay on this phone.</Text>
          {backups.length > 0 && <Text style={[s.body, { color: c.warn }]}>{backups.length} {backups.length === 1 ? 'set is' : 'sets are'} waiting to be saved to your account. Open them from home to retry.</Text>}
        </Card>

        <Button label="Sign out" icon="log-out" variant="danger" onPress={doSignOut} testID="button-sign-out" />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.5 },
  profile: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  banner: { height: 120, overflow: 'hidden' },
  bannerTag: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, marginTop: -40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  swatch: { width: '47%', flexGrow: 1, borderWidth: 2, borderRadius: 16, padding: 12, gap: 10 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
});
