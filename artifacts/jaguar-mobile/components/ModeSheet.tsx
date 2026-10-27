import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, Notice, tap } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { ALL_MODES, MODE_INFO, intIn } from '@/lib/study';
import { useWorkspace } from '@/lib/workspace';

export function ModeSheet({ visible, onClose, onGenerate }: { visible: boolean; onClose: () => void; onGenerate: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const w = useWorkspace();
  const [tried, setTried] = useState(false);
  const all = w.modes.length === ALL_MODES.length;
  const needsCount = w.modes.includes('objective') || w.modes.includes('timed');
  const countBad = intIn(w.questionCount, 1, 50) === null;
  const minBad = intIn(w.examMinutes, 1, 180) === null;
  const problem = w.validate();
  const toggle = (id: (typeof ALL_MODES)[number]) => w.setModes(w.modes.includes(id) ? w.modes.filter((m) => m !== id) : ALL_MODES.filter((m) => m === id || w.modes.includes(m)));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.head, { borderBottomColor: c.border }]}>
          <Text style={[styles.title, { color: c.foreground }]}>How do you want to study it?</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={[styles.close, { backgroundColor: c.card }]} testID="button-close-modes">
            <Feather name="x" size={18} color={c.foreground} />
          </Pressable>
        </View>
        <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" bottomOffset={20}>
          <Pressable onPress={() => { tap(); w.setModes(all ? [] : [...ALL_MODES]); }} style={styles.selectAll} accessibilityRole="checkbox" accessibilityState={{ checked: all }} testID="toggle-select-all">
            <View style={[styles.tick, { borderColor: all ? c.primary : c.borderStrong, backgroundColor: all ? c.primary : 'transparent' }]}>{all && <Feather name="check" size={13} color={c.primaryForeground} />}</View>
            <Text style={[styles.selectAllText, { color: c.foreground }]}>Select all six</Text>
          </Pressable>
          <View style={styles.grid}>
            {MODE_INFO.map((m) => {
              const on = w.modes.includes(m.id);
              return (
                <Pressable key={m.id} onPress={() => { tap(); toggle(m.id); }} accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID={`toggle-mode-${m.id}`}
                  style={[styles.chip, { backgroundColor: on ? c.primarySoft : c.card, borderColor: on ? c.primary : c.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Feather name={m.icon as React.ComponentProps<typeof Feather>['name']} size={18} color={on ? c.primary : c.mutedForeground} />
                    <View style={[styles.tick, { borderColor: on ? c.primary : c.borderStrong, backgroundColor: on ? c.primary : 'transparent' }]}>{on && <Feather name="check" size={13} color={c.primaryForeground} />}</View>
                  </View>
                  <Text style={[styles.chipTitle, { color: c.foreground }]}>{m.label}</Text>
                  <Text style={[styles.chipBlurb, { color: c.mutedForeground }]}>{m.blurb}</Text>
                </Pressable>
              );
            })}
          </View>
          {needsCount && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <NumberField label="Objective questions" hint="1 to 50" value={w.questionCount} onChange={w.setQuestionCount} bad={tried && countBad} testID="input-question-count" />
              {w.modes.includes('timed') && <NumberField label="Exam minutes" hint="1 to 180" value={w.examMinutes} onChange={w.setExamMinutes} bad={tried && minBad} testID="input-exam-minutes" />}
            </View>
          )}
          {w.modes.includes('timed') && <Text style={[styles.hint, { color: c.mutedForeground }]}>The timed paper also includes seven theory questions: answer one of two in Part A and three of five in Part B.</Text>}
          {tried && problem ? <Notice text={problem} testID="error-modes" /> : null}
          <Button
            label={`Generate ${w.modes.length} ${w.modes.length === 1 ? 'mode' : 'modes'}`}
            icon="play"
            disabled={!w.modes.length || w.gen.phase === 'generating'}
            onPress={() => { setTried(true); if (!w.validate()) onGenerate(); }}
            testID="button-generate"
          />
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

function NumberField({ label, hint, value, onChange, bad, testID }: { label: string; hint: string; value: string; onChange: (v: string) => void; bad: boolean; testID: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{label}</Text>
      <TextInput value={value} onChangeText={(v) => onChange(v.replace(/[^\d]/g, '').slice(0, 3))} keyboardType="number-pad" testID={testID}
        style={{ borderWidth: 1, borderColor: bad ? c.destructive : c.border, backgroundColor: c.card, borderRadius: 14, paddingHorizontal: 14, minHeight: 50, color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 18 }} />
      <Text style={{ color: bad ? c.destructive : c.faint, fontFamily: 'Inter_400Regular', fontSize: 12 }}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, gap: 12 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, flex: 1 },
  close: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  selectAllText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  tick: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 18, padding: 14, gap: 8, minHeight: 112 },
  chipTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  chipBlurb: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
});
