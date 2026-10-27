import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export function Button({ label, onPress, icon, variant = 'primary', disabled, busy, testID, style, small }: {
  label: string; onPress: () => void; icon?: FeatherName; variant?: 'primary' | 'quiet' | 'danger' | 'ghost';
  disabled?: boolean; busy?: boolean; testID?: string; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const c = useColors();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.destructiveSoft : variant === 'quiet' ? c.cardRaised : 'transparent';
  const fg = variant === 'primary' ? c.primaryForeground : variant === 'danger' ? c.destructive : c.foreground;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [
        styles.btn, small && styles.btnSmall,
        { backgroundColor: bg, borderColor: variant === 'quiet' ? c.border : 'transparent', opacity: disabled ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : icon ? <Feather name={icon} size={small ? 14 : 16} color={fg} /> : null}
      <Text style={[styles.btnText, small && { fontSize: 13 }, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, testID, tone, size = 44, active }: {
  icon: FeatherName; onPress: () => void; label: string; testID?: string; tone?: 'danger'; size?: number; active?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [styles.iconBtn, { width: size, height: size, backgroundColor: active ? c.primarySoft : c.card, borderColor: active ? c.primary : c.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Feather name={icon} size={18} color={tone === 'danger' ? c.destructive : active ? c.primary : c.foreground} />
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const c = useColors();
  return <View testID={testID} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>;
}

export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  const c = useColors();
  return <Text style={[styles.eyebrow, { color: color ?? c.mutedForeground }]}>{children}</Text>;
}

export function Empty({ icon, title, body, action }: { icon: FeatherName; title: string; body?: string; action?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.empty, { borderColor: c.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: c.primarySoft }]}><Feather name={icon} size={18} color={c.primary} /></View>
      <Text style={[styles.emptyTitle, { color: c.foreground }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: c.mutedForeground }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function Notice({ tone = 'error', text, action, testID }: { tone?: 'error' | 'info' | 'good' | 'warn'; text: string; action?: React.ReactNode; testID?: string }) {
  const c = useColors();
  const col = tone === 'error' ? c.destructive : tone === 'good' ? c.good : tone === 'warn' ? c.warn : c.primary;
  const icon: FeatherName = tone === 'error' ? 'alert-circle' : tone === 'good' ? 'check-circle' : tone === 'warn' ? 'alert-triangle' : 'info';
  return (
    <View testID={testID} accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.notice, { borderColor: `${col}55`, backgroundColor: `${col}14` }]}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Feather name={icon} size={16} color={col} style={{ marginTop: 2 }} />
        <Text style={[styles.noticeText, { color: c.foreground }]}>{text}</Text>
      </View>
      {action ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{action}</View> : null}
    </View>
  );
}

export function Skeleton({ height = 72, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.9, duration: 700, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [o]);
  return <Animated.View style={[{ height, borderRadius: 16, backgroundColor: c.cardRaised, opacity: o }, style]} />;
}

export function Pill({ label, active, onPress, icon, testID }: { label: string; active?: boolean; onPress?: () => void; icon?: FeatherName; testID?: string }) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!active }}
      onPress={onPress ? () => { tap(); onPress(); } : undefined}
      style={[styles.pill, { backgroundColor: active ? c.primary : c.card, borderColor: active ? c.primary : c.border }]}
    >
      {icon ? <Feather name={icon} size={14} color={active ? c.primaryForeground : c.mutedForeground} /> : null}
      <Text style={[styles.pillText, { color: active ? c.primaryForeground : c.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export const webTop = Platform.OS === 'web' ? 67 : 0;
export const webBottom = Platform.OS === 'web' ? 34 : 0;

const styles = StyleSheet.create({
  btn: { minHeight: 50, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  btnSmall: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12 },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  iconBtn: { borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  card: { borderRadius: 20, borderWidth: 1, padding: 18 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
  emptyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, textAlign: 'center' },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  noticeText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: 999, borderWidth: 1 },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
