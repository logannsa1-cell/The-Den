import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useSSO } from '@clerk/expo';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Jaguar } from '@/components/Jaguar';
import { Button, Notice, webBottom, webTop } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

export function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

export function AuthShell({ title, subtitle, children, onBack }: { title: string; subtitle?: string; children: React.ReactNode; onBack?: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingTop: insets.top + webTop + 12, paddingBottom: insets.bottom + webBottom + 32, paddingHorizontal: 22, gap: 22 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} style={[styles.back, { borderColor: c.border, backgroundColor: c.card }]} testID="button-auth-back">
        <Feather name="chevron-left" size={20} color={c.foreground} />
      </Pressable>
      <View style={{ gap: 14 }}>
        <Jaguar size={56} />
        <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, { color: c.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {children}
    </KeyboardAwareScrollViewCompat>
  );
}

export function Field({ label, error, secure, ...props }: TextInputProps & { label: string; error?: string; secure?: boolean }) {
  const c = useColors();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: c.mutedForeground }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: c.card, borderColor: error ? c.destructive : c.border }]}>
        <TextInput
          placeholderTextColor={c.faint}
          style={[styles.input, { color: c.foreground }]}
          secureTextEntry={secure && hidden}
          {...props}
        />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} onPress={() => setHidden((h) => !h)} hitSlop={10} style={{ padding: 6 }}>
            <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={c.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: c.destructive }]}>{error}</Text> : null}
    </View>
  );
}

export function Divider({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      <Text style={{ color: c.faint, fontFamily: 'Inter_500Medium', fontSize: 12 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
    </View>
  );
}

/** Google sign-in / sign-up via Clerk SSO. */
export function GoogleButton() {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const onPress = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        await setActive!({
          session: createdSessionId,
          navigate: async ({ session }) => {
            if (session?.currentTask) return;
            router.replace('/home');
          },
        });
      } else {
        setError('Google sign-in needs another step that the app cannot finish. Try email and password instead.');
      }
    } catch (err) {
      const msg = (err as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
      setError(msg?.longMessage || msg?.message || 'Google sign-in did not finish. Try again.');
    } finally {
      setBusy(false);
    }
  }, [startSSOFlow, router]);
  return (
    <View style={{ gap: 10 }}>
      <Button label="Continue with Google" icon="globe" variant="quiet" onPress={() => void onPress()} busy={busy} testID="button-google" />
      {error ? <Notice text={error} /> : null}
    </View>
  );
}

export function clerkError(error: unknown): string {
  const e = error as { longMessage?: string; message?: string; errors?: { longMessage?: string; message?: string }[] } | null;
  if (!e) return '';
  return e.errors?.[0]?.longMessage || e.errors?.[0]?.message || e.longMessage || e.message || 'Something went wrong. Try again.';
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.8 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 52 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, paddingVertical: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});
