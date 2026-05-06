import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function PrepScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    prospectName, setProspectName,
    prospectCompany, setProspectCompany,
    prospectRole, setProspectRole,
    objective, setObjective,
    talkingPoints, setTalkingPoints,
  } = useApp();

  const [newPoint, setNewPoint] = useState('');

  function addPoint() {
    const trimmed = newPoint.trim();
    if (!trimmed) return;
    setTalkingPoints([...talkingPoints, trimmed]);
    setNewPoint('');
  }

  function removePoint(index: number) {
    setTalkingPoints(talkingPoints.filter((_, i) => i !== index));
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.logo, { color: colors.primary }]}>SayNow</Text>
          <Text style={[styles.logoSub, { color: colors.foreground }]}>Pro</Text>
        </View>

        {/* Objective */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CALL OBJECTIVE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.foreground, borderColor: colors.border }]}
            value={objective}
            onChangeText={setObjective}
            placeholder="What's the goal of this call?"
            placeholderTextColor={colors.mutedForeground}
            multiline
          />
        </View>

        {/* Prospect info */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PROSPECT</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.foreground, borderColor: colors.border }]}
            value={prospectName}
            onChangeText={setProspectName}
            placeholder="Name"
            placeholderTextColor={colors.mutedForeground}
          />
          <TextInput
            style={[styles.input, styles.inputMt, { backgroundColor: colors.input, color: colors.foreground, borderColor: colors.border }]}
            value={prospectCompany}
            onChangeText={setProspectCompany}
            placeholder="Company"
            placeholderTextColor={colors.mutedForeground}
          />
          <TextInput
            style={[styles.input, styles.inputMt, { backgroundColor: colors.input, color: colors.foreground, borderColor: colors.border }]}
            value={prospectRole}
            onChangeText={setProspectRole}
            placeholder="Role / Title"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Talking Points */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TALKING POINTS</Text>

          {talkingPoints.map((point, i) => (
            <View key={`${point}-${i}`} style={[styles.pointRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.pointDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.pointText, { color: colors.foreground }]} numberOfLines={2}>{point}</Text>
              <TouchableOpacity onPress={() => removePoint(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={[styles.addRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.addInput, { color: colors.foreground }]}
              value={newPoint}
              onChangeText={setNewPoint}
              placeholder="Add a talking point..."
              placeholderTextColor={colors.mutedForeground}
              onSubmitEditing={addPoint}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={addPoint}
              style={[styles.addBtn, { backgroundColor: colors.primary, opacity: newPoint.trim() ? 1 : 0.4 }]}
              disabled={!newPoint.trim()}
            >
              <Feather name="plus" size={16} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Start CTA */}
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(tabs)/live')}
          activeOpacity={0.85}
        >
          <Feather name="mic" size={18} color={colors.primaryForeground} />
          <Text style={[styles.startBtnText, { color: colors.primaryForeground }]}>Go Live</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 28 },
  logo: { fontSize: 28, fontWeight: '900' as const, fontFamily: 'Inter_700Bold' },
  logoSub: { fontSize: 28, fontWeight: '900' as const, fontFamily: 'Inter_700Bold', marginLeft: 4 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  inputMt: { marginTop: 8 },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  pointDot: { width: 6, height: 6, borderRadius: 3 },
  pointText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
    gap: 8,
  },
  addInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', paddingVertical: 6 },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  startBtnText: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
});
