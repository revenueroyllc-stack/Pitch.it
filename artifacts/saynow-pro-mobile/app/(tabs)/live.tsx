import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoachCardView } from '@/components/CoachCard';
import { useApp, type CoachCard, type NoteEntry, type Session } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : 'http://localhost:80';

const COACH_INTERVAL_MS = 8000;

function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type EventType = 'objection' | 'silence' | 'competitor' | 'no-question' | 'talk-ratio-warning' | 'filler-spike';

const EVENT_BUTTONS: { type: EventType; label: string; icon: string; color: string }[] = [
  { type: 'objection',          label: 'Objection',  icon: 'alert-triangle', color: '#ff4757' },
  { type: 'silence',            label: 'Silence',    icon: 'volume-x',       color: '#c9960c' },
  { type: 'competitor',         label: 'Competitor', icon: 'shield',         color: '#4a90d9' },
  { type: 'no-question',        label: 'No Q',       icon: 'help-circle',    color: '#00c896' },
  { type: 'talk-ratio-warning', label: 'Too Much',   icon: 'mic',            color: '#f5d97e' },
  { type: 'filler-spike',       label: 'Fillers',    icon: 'wind',           color: '#9b59b6' },
];

export default function LiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { objective, talkingPoints, addSession } = useApp();

  const [sessionLive, setSessionLive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [coachCards, setCoachCards] = useState<CoachCard[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [aiThinking, setAiThinking] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const notesRef = useRef<NoteEntry[]>([]);
  const cardsRef = useRef<CoachCard[]>([]);
  const sessionLiveRef = useRef(false);
  const eventInFlight = useRef(false);

  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { cardsRef.current = coachCards; }, [coachCards]);
  useEffect(() => { sessionLiveRef.current = sessionLive; }, [sessionLive]);

  // Periodic coaching interval
  useEffect(() => {
    if (!sessionLive) return;

    const id = setInterval(async () => {
      if (!sessionLiveRef.current) return;
      const recentNotes = notesRef.current.slice(-5);
      const recentTranscript = recentNotes.map((n) => ({ speaker: 'You', text: n.text, timestamp: n.timestamp }));
      await callClaudeCoach({ type: 'live-coach', recentTranscript, elapsedSeconds: elapsedRef.current });
    }, COACH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [sessionLive]); // eslint-disable-line react-hooks/exhaustive-deps

  async function callClaudeCoach(payload: object) {
    setAiThinking(true);
    try {
      const res = await fetch(`${BASE_URL}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, talkingPoints }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        const ts = formatTimer(elapsedRef.current);
        const newCards: CoachCard[] = data.cards.map((c: Partial<CoachCard>) => ({
          id: makeId(),
          type: c.type || 'Tip',
          tone: c.tone || 'tip',
          trigger: c.trigger || 'AI coach',
          text: c.text || '',
          timestamp: ts,
        }));
        setCoachCards((prev) => [...newCards, ...prev].slice(0, 30));
      }
    } catch {
      // Best effort
    } finally {
      setAiThinking(false);
    }
  }

  function startSession() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setElapsed(0);
    elapsedRef.current = 0;
    setNotes([]);
    setCoachCards([]);
    setSessionLive(true);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  }

  function stopSession() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSessionLive(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const session: Session = {
      id: makeId(),
      objective,
      duration: elapsedRef.current,
      notes: notesRef.current,
      coachCards: cardsRef.current,
      createdAt: new Date().toISOString(),
    };
    addSession(session);
  }

  async function fireEventTrigger(eventType: EventType, competitor?: string) {
    if (eventInFlight.current) return;
    eventInFlight.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await callClaudeCoach({
        type: 'event-coach',
        triggerType: eventType,
        competitor,
        utterance: notesRef.current.slice(-1)[0]?.text ?? '',
        elapsedSeconds: elapsedRef.current,
      });
    } finally {
      setTimeout(() => { eventInFlight.current = false; }, 3000);
    }
  }

  function handleCompetitorPress() {
    if (Platform.OS === 'ios') {
      Alert.prompt('Competitor', 'Which competitor was mentioned?', (name) => {
        if (name?.trim()) fireEventTrigger('competitor', name.trim());
      });
    } else {
      // Android & Web: use browser prompt (web) or fire generic trigger (Android)
      if (Platform.OS === 'web') {
        const name = window.prompt('Which competitor was mentioned?');
        if (name?.trim()) fireEventTrigger('competitor', name.trim());
      } else {
        // Android: fire without a specific name (agent will ask generically)
        fireEventTrigger('competitor');
      }
    }
  }

  function addNote() {
    const text = noteInput.trim();
    if (!text) return;
    const entry: NoteEntry = { id: makeId(), text, timestamp: formatTimer(elapsedRef.current) };
    setNotes((prev) => [...prev, entry]);
    setNoteInput('');
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: botPad + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Timer */}
        <View style={styles.timerSection}>
          <Text style={[styles.timer, { color: sessionLive ? colors.primary : colors.mutedForeground }]}>
            {formatTimer(elapsed)}
          </Text>
          {sessionLive && (
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: colors.destructive }]} />
              <Text style={[styles.liveLabel, { color: colors.destructive }]}>LIVE</Text>
            </View>
          )}
          {!sessionLive && elapsed > 0 && (
            <Text style={[styles.savedLabel, { color: colors.success }]}>Session saved to Debrief</Text>
          )}
        </View>

        {/* Start / Stop */}
        <TouchableOpacity
          style={[styles.mainBtn, sessionLive
            ? { backgroundColor: colors.destructive }
            : { backgroundColor: colors.primary }
          ]}
          onPress={sessionLive ? stopSession : startSession}
          activeOpacity={0.85}
        >
          <Feather name={sessionLive ? 'square' : 'mic'} size={20} color={sessionLive ? '#fff' : colors.primaryForeground} />
          <Text style={[styles.mainBtnText, { color: sessionLive ? '#fff' : colors.primaryForeground }]}>
            {sessionLive ? 'End Session' : 'Start Session'}
          </Text>
        </TouchableOpacity>

        {/* Objective reminder */}
        {!!objective && (
          <View style={[styles.objectiveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.objectiveLabel, { color: colors.mutedForeground }]}>OBJECTIVE</Text>
            <Text style={[styles.objectiveText, { color: colors.foreground }]}>{objective}</Text>
          </View>
        )}

        {/* Event trigger buttons */}
        {sessionLive && (
          <View style={styles.eventGrid}>
            {EVENT_BUTTONS.map((btn) => (
              <TouchableOpacity
                key={btn.type}
                style={[styles.eventBtn, { backgroundColor: `${btn.color}18`, borderColor: `${btn.color}40` }]}
                onPress={() => btn.type === 'competitor' ? handleCompetitorPress() : fireEventTrigger(btn.type)}
                activeOpacity={0.7}
              >
                <Feather name={btn.icon as any} size={16} color={btn.color} />
                <Text style={[styles.eventBtnText, { color: btn.color }]}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Note input */}
        {sessionLive && (
          <View style={[styles.noteInputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.noteInput, { color: colors.foreground }]}
              value={noteInput}
              onChangeText={setNoteInput}
              placeholder="Log what's happening..."
              placeholderTextColor={colors.mutedForeground}
              onSubmitEditing={addNote}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={addNote} disabled={!noteInput.trim()}>
              <Feather name="send" size={18} color={noteInput.trim() ? colors.primary : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* Recent notes */}
        {sessionLive && notes.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={[styles.notesSectionLabel, { color: colors.mutedForeground }]}>NOTES</Text>
            {notes.slice(-5).reverse().map((n) => (
              <View key={n.id} style={[styles.noteEntry, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.noteTs, { color: colors.primary }]}>{n.timestamp}</Text>
                <Text style={[styles.noteText, { color: colors.foreground }]}>{n.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* AI thinking indicator */}
        {aiThinking && (
          <View style={[styles.thinkingRow, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
            <View style={[styles.thinkingDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.thinkingText, { color: colors.primary }]}>AI coach analyzing...</Text>
          </View>
        )}

        {/* Coach cards */}
        {coachCards.length > 0 && (
          <View style={styles.cardsSection}>
            <Text style={[styles.cardsSectionLabel, { color: colors.mutedForeground }]}>COACH FEED</Text>
            {coachCards.map((card) => <CoachCardView key={card.id} card={card} />)}
          </View>
        )}

        {/* Empty state */}
        {!sessionLive && coachCards.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="mic-off" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Tap Start Session when your call begins.{'\n'}AI coaching fires every 8 seconds.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  timerSection: { alignItems: 'center', marginBottom: 20 },
  timer: { fontSize: 64, fontWeight: '900' as const, fontFamily: 'Inter_700Bold', letterSpacing: -2 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 2 },
  savedLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  mainBtnText: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  objectiveCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  objectiveLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  objectiveText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  eventBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  eventBtnText: { fontSize: 12, fontWeight: '700' as const, fontFamily: 'Inter_600SemiBold' },
  noteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 16,
  },
  noteInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  notesSection: { marginBottom: 16 },
  notesSectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  noteEntry: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  noteTs: { fontSize: 11, fontFamily: 'Inter_600SemiBold', minWidth: 36 },
  noteText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  thinkingDot: { width: 6, height: 6, borderRadius: 3 },
  thinkingText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  cardsSection: { marginBottom: 16 },
  cardsSectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  emptyState: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
});
