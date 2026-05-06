import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { CoachCard as CoachCardType } from '@/context/AppContext';

const TONE_COLORS: Record<string, string> = {
  warning: '#ff4757',
  response: '#4a90d9',
  battlecard: '#c9960c',
  question: '#00c896',
  tip: '#888888',
};

const TONE_LABELS: Record<string, string> = {
  warning: '⚠ Warning',
  response: '💬 Response',
  battlecard: '⚔ Battlecard',
  question: '❓ Question',
  tip: '💡 Tip',
};

interface Props {
  card: CoachCardType;
}

export function CoachCardView({ card }: Props) {
  const colors = useColors();
  const accentColor = TONE_COLORS[card.tone] ?? '#888';
  const label = TONE_LABELS[card.tone] ?? card.type;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: accentColor }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: accentColor }]}>{label}</Text>
        <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>{card.timestamp}</Text>
      </View>
      <Text style={[styles.trigger, { color: colors.mutedForeground }]}>{card.trigger}</Text>
      <Text style={[styles.text, { color: colors.foreground }]}>{card.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  trigger: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
});
