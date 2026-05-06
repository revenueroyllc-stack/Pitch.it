import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, type Outcome, type Session } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : 'http://localhost:80';

const OUTCOMES: { value: Outcome; label: string; color: string; icon: string }[] = [
  { value: 'closed',      label: 'Closed',             color: '#00c896', icon: 'award' },
  { value: 'follow_up',   label: 'Follow-up',          color: '#4a90d9', icon: 'calendar' },
  { value: 'no_interest', label: 'No Interest',        color: '#ff4757', icon: 'x-circle' },
  { value: 'voicemail',   label: 'Voicemail',          color: '#c9960c', icon: 'phone-missed' },
];

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface AiDebrief {
  score?: number;
  wins?: string[];
  misses?: string[];
  followUpEmail?: string;
}

export default function DebriefScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions, updateSession, deleteSession } = useApp();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiDebrief, setAiDebrief] = useState<AiDebrief | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  function selectSession(s: Session) {
    setSelectedId(s.id);
    setAiDebrief(null);
    setCopied(false);
  }

  function setOutcome(outcome: Outcome) {
    if (!selectedId) return;
    Haptics.selectionAsync();
    updateSession(selectedId, { outcome });
  }

  function confirmDelete(id: string) {
    Alert.alert('Delete Session', 'Remove this session from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deleteSession(id);
        if (selectedId === id) setSelectedId(null);
      }},
    ]);
  }

  async function fetchAiDebrief() {
    if (!selectedSession) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'debrief',
          transcript: selectedSession.notes.map((n) => ({ speaker: 'You', text: n.text, timestamp: n.timestamp })),
          coachCards: selectedSession.coachCards,
          score: selectedSession.score ?? 50,
          sentiment: 50,
          talkRatio: 50,
          duration: selectedSession.duration,
          objective: selectedSession.objective,
          objections: [],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAiDebrief({
        score: data.score,
        wins: data.wins,
        misses: data.misses,
        followUpEmail: data.followUpEmail,
      });
      if (typeof data.score === 'number') {
        updateSession(selectedSession.id, { score: data.score });
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate debrief');
    } finally {
      setAiLoading(false);
    }
  }

  async function copyEmail() {
    if (!aiDebrief?.followUpEmail) return;
    await Clipboard.setStringAsync(aiDebrief.followUpEmail);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: botPad + 80 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>Debrief</Text>

      {/* Session list */}
      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="file-text" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No sessions yet.{'\n'}End a Live session to see it here.
          </Text>
        </View>
      ) : (
        <View style={styles.listSection}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>RECENT SESSIONS</Text>
          {sessions.map((session) => {
            const isSelected = session.id === selectedId;
            const outcomeInfo = OUTCOMES.find((o) => o.value === session.outcome);
            return (
              <TouchableOpacity
                key={session.id}
                style={[styles.sessionRow, {
                  backgroundColor: isSelected ? `${colors.primary}12` : colors.card,
                  borderColor: isSelected ? `${colors.primary}40` : colors.border,
                }]}
                onPress={() => selectSession(session)}
                activeOpacity={0.8}
              >
                <View style={styles.sessionRowLeft}>
                  <Text style={[styles.sessionObjective, { color: colors.foreground }]} numberOfLines={1}>
                    {session.objective || 'Untitled'}
                  </Text>
                  <View style={styles.sessionMeta}>
                    <Text style={[styles.sessionMetaText, { color: colors.mutedForeground }]}>
                      {formatDuration(session.duration)} · {formatDate(session.createdAt)}
                    </Text>
                    {outcomeInfo && (
                      <View style={[styles.outcomePill, { backgroundColor: `${outcomeInfo.color}18`, borderColor: `${outcomeInfo.color}40` }]}>
                        <Text style={[styles.outcomePillText, { color: outcomeInfo.color }]}>{outcomeInfo.label}</Text>
                      </View>
                    )}
                    {typeof session.score === 'number' && (
                      <Text style={[styles.scoreText, { color: session.score >= 75 ? '#00c896' : session.score >= 50 ? '#c9960c' : '#ff4757' }]}>
                        {session.score}/100
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => confirmDelete(session.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Session detail */}
      {selectedSession && (
        <View style={styles.detailSection}>
          {/* Outcome picker */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CALL OUTCOME</Text>
          <View style={styles.outcomeGrid}>
            {OUTCOMES.map((opt) => {
              const isSelected = selectedSession.outcome === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.outcomeBtn, {
                    backgroundColor: isSelected ? `${opt.color}18` : colors.card,
                    borderColor: isSelected ? `${opt.color}50` : colors.border,
                  }]}
                  onPress={() => setOutcome(opt.value)}
                  activeOpacity={0.8}
                >
                  <Feather name={opt.icon as any} size={18} color={opt.color} />
                  <Text style={[styles.outcomeBtnText, { color: isSelected ? opt.color : colors.mutedForeground }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Session notes summary */}
          {selectedSession.notes.length > 0 && (
            <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTES ({selectedSession.notes.length})</Text>
              {selectedSession.notes.slice(0, 4).map((n) => (
                <View key={n.id} style={styles.noteRow}>
                  <Text style={[styles.noteTs, { color: colors.primary }]}>{n.timestamp}</Text>
                  <Text style={[styles.noteText, { color: colors.foreground }]} numberOfLines={2}>{n.text}</Text>
                </View>
              ))}
              {selectedSession.notes.length > 4 && (
                <Text style={[styles.moreNotes, { color: colors.mutedForeground }]}>
                  +{selectedSession.notes.length - 4} more
                </Text>
              )}
            </View>
          )}

          {/* AI Debrief */}
          <TouchableOpacity
            style={[styles.aiBtn, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}10` }]}
            onPress={fetchAiDebrief}
            disabled={aiLoading}
            activeOpacity={0.8}
          >
            <Feather name="cpu" size={16} color={colors.primary} />
            <Text style={[styles.aiBtnText, { color: colors.primary }]}>
              {aiLoading ? 'Analyzing...' : aiDebrief ? 'Regenerate Debrief' : 'Generate AI Debrief'}
            </Text>
          </TouchableOpacity>

          {/* AI results */}
          {aiDebrief && (
            <View style={styles.aiResults}>
              {aiDebrief.score !== undefined && (
                <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.scoreValue, {
                    color: aiDebrief.score >= 75 ? '#00c896' : aiDebrief.score >= 50 ? '#c9960c' : '#ff4757'
                  }]}>
                    {aiDebrief.score}
                  </Text>
                  <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>AI Call Score</Text>
                </View>
              )}

              {aiDebrief.wins && aiDebrief.wins.length > 0 && (
                <View style={[styles.feedbackCard, { backgroundColor: `rgba(0,200,150,0.05)`, borderColor: `rgba(0,200,150,0.25)` }]}>
                  <Text style={[styles.feedbackLabel, { color: '#00c896' }]}>WINS</Text>
                  {aiDebrief.wins.map((w, i) => (
                    <View key={i} style={styles.feedbackRow}>
                      <Text style={{ color: '#00c896', fontWeight: '700' as const }}>+</Text>
                      <Text style={[styles.feedbackText, { color: colors.foreground }]}>{w}</Text>
                    </View>
                  ))}
                </View>
              )}

              {aiDebrief.misses && aiDebrief.misses.length > 0 && (
                <View style={[styles.feedbackCard, { backgroundColor: `rgba(245,217,126,0.05)`, borderColor: `rgba(245,217,126,0.25)` }]}>
                  <Text style={[styles.feedbackLabel, { color: '#f5d97e' }]}>IMPROVE</Text>
                  {aiDebrief.misses.map((m, i) => (
                    <View key={i} style={styles.feedbackRow}>
                      <Text style={{ color: '#f5d97e' }}>→</Text>
                      <Text style={[styles.feedbackText, { color: colors.foreground }]}>{m}</Text>
                    </View>
                  ))}
                </View>
              )}

              {!!aiDebrief.followUpEmail && (
                <View style={[styles.emailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.emailHeader}>
                    <Text style={[styles.feedbackLabel, { color: colors.mutedForeground }]}>FOLLOW-UP EMAIL</Text>
                    <TouchableOpacity onPress={copyEmail}>
                      <Feather name={copied ? 'check' : 'copy'} size={14} color={copied ? '#00c896' : colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.emailText, { color: colors.foreground }]}>{aiDebrief.followUpEmail}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  pageTitle: { fontSize: 28, fontWeight: '900' as const, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  emptyState: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  listSection: { marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  sessionRowLeft: { flex: 1 },
  sessionObjective: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sessionMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  outcomePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  outcomePillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  scoreText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  detailSection: {},
  outcomeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  outcomeBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  outcomeBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  notesCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  noteRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  noteTs: { fontSize: 11, fontFamily: 'Inter_600SemiBold', minWidth: 36 },
  noteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  moreNotes: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    marginBottom: 16,
  },
  aiBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  aiResults: { gap: 12, marginBottom: 24 },
  scoreCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  scoreValue: { fontSize: 48, fontWeight: '900' as const, fontFamily: 'Inter_700Bold', lineHeight: 52 },
  scoreLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  feedbackCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  feedbackLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  feedbackRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  feedbackText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  emailCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  emailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  emailText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
