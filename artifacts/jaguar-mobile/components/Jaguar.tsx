import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

/** Native port of the web jaguar-icon.svg; every purple follows the active accent. */
export function Jaguar({ size = 40, framed = true }: { size?: number; framed?: boolean }) {
  const c = useColors();
  const side = (mirror: boolean) => (
    <G transform={mirror ? 'translate(512 0) scale(-1 1)' : undefined}>
      <Path d="M176 218 Q204 192 236 212 Q206 238 176 218 Z" fill="url(#eye)" stroke="#0b0614" strokeWidth={3} strokeLinejoin="round" />
      <Ellipse cx={208} cy={214} rx={4.5} ry={11} fill="#05030a" transform="rotate(8 208 214)" />
      <Circle cx={213} cy={209} r={2.4} fill="#f4f0fa" />
      <Path d="M172 200 Q205 172 244 196" fill="none" stroke={c.primary} strokeWidth={3.5} strokeLinecap="round" />
      <Path d="M226 138 L232 162" stroke={c.primary} strokeWidth={4} strokeLinecap="round" />
      <Path d="M208 146 L216 168" stroke={c.primary} strokeWidth={3} strokeLinecap="round" />
      <Path d="M190 156 L200 174" stroke={c.primary} strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
      <G fill="none" stroke={c.primary} strokeWidth={4.5} strokeLinecap="round">
        <Path d="M156 236 q8 -10 18 -4 q6 9 -2 15 q-12 3 -16 -11 z" />
        <Path d="M178 272 q9 -10 20 -3 q6 10 -3 17 q-13 3 -17 -14 z" />
        <Path d="M204 308 q8 -8 17 -2 q5 8 -2 13 q-11 3 -15 -11 z" opacity={0.85} />
      </G>
      <G fill={c.primary}>
        <Circle cx={165} cy={241} r={2.8} /><Circle cx={188} cy={277} r={2.8} /><Circle cx={211} cy={311} r={2.3} />
        <Circle cx={162} cy={190} r={2.6} /><Circle cx={152} cy={212} r={2.2} /><Circle cx={236} cy={178} r={2.2} />
      </G>
      <Path d="M148 276 L128 290 L152 292 Z" fill="#0e0e15" stroke="url(#rim)" strokeWidth={2} strokeLinejoin="round" />
      <G stroke={c.primaryLight} strokeWidth={3} strokeLinecap="round" opacity={0.85} fill="none">
        <Path d="M222 300 Q170 292 118 304" /><Path d="M222 310 Q172 312 124 330" />
      </G>
    </G>
  );
  const ear = (mirror: boolean) => (
    <G transform={mirror ? 'translate(512 0) scale(-1 1)' : undefined}>
      <Path d="M168 162 C148 132 138 100 148 80 C176 84 202 104 214 134 Z" fill="url(#fur)" stroke="url(#rim)" strokeWidth={3} strokeLinejoin="round" />
      <Path d="M171 142 C161 120 156 104 160 94 C177 98 193 112 202 130 Z" fill={c.primaryDeep} opacity={0.85} />
    </G>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="Jaguar">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.cardRaised} /><Stop offset="1" stopColor="#05030a" /></LinearGradient>
        <RadialGradient id="glow" cx="50%" cy="42%" r="50%"><Stop offset="0" stopColor={c.primary} stopOpacity={0.5} /><Stop offset="1" stopColor={c.primary} stopOpacity={0} /></RadialGradient>
        <LinearGradient id="fur" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#23232e" /><Stop offset="0.55" stopColor="#0e0e15" /><Stop offset="1" stopColor="#050508" /></LinearGradient>
        <LinearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={c.primaryLight} /><Stop offset="1" stopColor={c.primaryDeep} /></LinearGradient>
        <RadialGradient id="eye" cx="50%" cy="50%" r="60%"><Stop offset="0" stopColor={c.primaryLight} /><Stop offset="0.6" stopColor={c.primary} /><Stop offset="1" stopColor={c.primaryDeep} /></RadialGradient>
      </Defs>
      {framed && <>
        <Rect x={8} y={8} width={496} height={496} rx={112} fill="url(#bg)" />
        <Rect x={8} y={8} width={496} height={496} rx={112} fill="url(#glow)" />
        <Rect x={20} y={20} width={472} height={472} rx={100} fill="none" stroke="url(#rim)" strokeWidth={4} />
      </>}
      <G transform="translate(256 262) scale(1.22) translate(-256 -238)">
        {ear(false)}{ear(true)}
        <Path d="M256 124 C214 124 178 140 158 176 C138 208 130 244 150 280 C170 318 214 346 256 352 C298 346 342 318 362 280 C382 244 374 208 354 176 C334 140 298 124 256 124 Z" fill="url(#fur)" stroke="url(#rim)" strokeWidth={4} strokeLinejoin="round" />
        <Path d="M256 128 L256 176" stroke={c.primary} strokeWidth={4} strokeLinecap="round" />
        <Path d="M246 138 L256 150 L266 138" fill="none" stroke={c.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Ellipse cx={256} cy={298} rx={58} ry={44} fill="#1b1030" />
        <Ellipse cx={256} cy={298} rx={58} ry={44} fill="none" stroke={c.primaryDeep} strokeWidth={1.5} opacity={0.7} />
        {side(false)}{side(true)}
        <Path d="M234 266 Q256 258 278 266 L256 290 Z" fill={c.primaryLight} stroke="#0b0614" strokeWidth={2.5} strokeLinejoin="round" />
        <Path d="M256 290 L256 308" stroke="#05030a" strokeWidth={3} strokeLinecap="round" />
        <Path d="M256 308 Q240 326 218 316 M256 308 Q272 326 294 316" fill="none" stroke="#05030a" strokeWidth={3} strokeLinecap="round" />
        <Path d="M236 320 L240 336 L246 322 Z M276 320 L272 336 L266 322 Z" fill="#f4f0fa" />
      </G>
    </Svg>
  );
}

/** Subtle rosette spots for backgrounds. */
export function Rosettes({ size = 220, opacity = 0.12 }: { size?: number; opacity?: number }) {
  const c = useColors();
  const spots = [[40, 40], [120, 30], [80, 100], [170, 90], [30, 160], [130, 170], [190, 180]];
  return (
    <Svg width={size} height={size} viewBox="0 0 220 220" style={{ opacity }} pointerEvents="none">
      {spots.map(([x, y], i) => (
        <G key={i} transform={`translate(${x} ${y}) rotate(${i * 37})`}>
          <Path d="M-14 -4 q6 -12 18 -8 q12 6 6 18 q-8 10 -20 4 q-8 -6 -4 -14z" fill="none" stroke={c.primary} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="14 6" />
          <Circle cx={0} cy={1} r={3} fill={c.primary} />
        </G>
      ))}
    </Svg>
  );
}

/** Small jaguar running left while materials generate. */
export function JaguarRunner({ label }: { label: string }) {
  const c = useColors();
  const x = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.loop(Animated.timing(x, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }));
    const hop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    run.start(); hop.start();
    return () => { run.stop(); hop.stop(); };
  }, [x, bob]);
  return (
    <View style={styles.runnerWrap} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={[styles.track, { borderColor: c.border }]}>
        <Animated.View style={{ transform: [
          { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [240, -60] }) },
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
          { rotate: '-8deg' },
        ] }}>
          <Jaguar size={44} framed={false} />
        </Animated.View>
      </View>
      <Text style={[styles.runnerText, { color: c.foreground }]}>{label}</Text>
      <Text style={[styles.runnerSub, { color: c.mutedForeground }]}>Long sets can take a few minutes. Keep the app open.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  runnerWrap: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  track: { width: 240, height: 64, overflow: 'hidden', borderBottomWidth: 1, borderStyle: 'dashed', justifyContent: 'flex-end' },
  runnerText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, textAlign: 'center' },
  runnerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },
});
