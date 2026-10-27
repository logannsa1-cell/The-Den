import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Jaguar, Rosettes } from '@/components/Jaguar';
import { Button, Eyebrow, webBottom, webTop } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

const STEPS: { icon: React.ComponentProps<typeof Feather>['name']; title: string; body: string }[] = [
  { icon: 'upload', title: 'Bring your note', body: 'PDF, slides, Word, text or CSV. Several files become one set, kept by subject and week.' },
  { icon: 'book-open', title: 'Learn it properly', body: 'A long note summary, a tutor lesson that teaches, and a cram sheet for the night before.' },
  { icon: 'clock', title: 'Sit the paper', body: 'Objective A to E, theory with a, b, c parts, and one clock that keeps running if you leave.' },
];

export default function Welcome() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  if (isSignedIn) return <Redirect href="/home" />;
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={styles.spotsTop} pointerEvents="none"><Rosettes size={260} /></View>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + webTop + 24, paddingBottom: insets.bottom + webBottom + 28, paddingHorizontal: 22, gap: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Jaguar size={40} />
          <Text style={[styles.brand, { color: c.foreground }]}>Jaguar</Text>
        </View>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Jaguar size={168} />
        </View>
        <View style={{ gap: 10 }}>
          <Text style={[styles.hero, { color: c.foreground }]}>Exam is soon ooo</Text>
          <Text style={[styles.sub, { color: c.mutedForeground }]}>Bring your note so you can study</Text>
        </View>
        <View style={{ gap: 12 }}>
          <Button label="Create account" icon="arrow-right" onPress={() => router.push('/sign-up')} testID="button-welcome-sign-up" />
          <Button label="I already have an account" variant="quiet" onPress={() => router.push('/sign-in')} testID="button-welcome-sign-in" />
          <Text style={[styles.small, { color: c.faint }]}>Same account as the Jaguar website. Your saved sets follow you.</Text>
        </View>
        <View style={{ gap: 4 }}>
          <Eyebrow>How it works</Eyebrow>
          {STEPS.map((s, i) => (
            <View key={s.title} style={[styles.step, { borderBottomColor: c.border }, i === STEPS.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.stepIcon, { backgroundColor: c.primarySoft }]}><Feather name={s.icon} size={18} color={c.primary} /></View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.stepTitle, { color: c.foreground }]}>{s.title}</Text>
                <Text style={[styles.stepBody, { color: c.mutedForeground }]}>{s.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  spotsTop: { position: 'absolute', top: -30, right: -50 },
  brand: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.4 },
  hero: { fontFamily: 'Inter_700Bold', fontSize: 40, letterSpacing: -1.2, lineHeight: 44 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 17, lineHeight: 24 },
  small: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  step: { flexDirection: 'row', gap: 14, paddingVertical: 16, borderBottomWidth: 1 },
  stepIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  stepBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
});
