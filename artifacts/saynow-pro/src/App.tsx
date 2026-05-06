import { useState, useEffect, useRef, useMemo } from 'react';
import { Router, Route } from 'wouter';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  analyzeSentiment,
  calculateTalkRatio,
  calculateLiveScore,
  formatTime,
  dedupeCards,
  buildHeuristicCoachCards,
  initialObjections,
  initialTalkingPoints,
  type CoachCard,
  type Objection,
  type TranscriptEntry,
} from '@/lib/coach';
import { decideAction } from '@/lib/decisionEngine';
import { useDeepgram, type MicStatus, type EventTrigger } from '@/lib/useDeepgram';
import { TopBar } from '@/components/layout/TopBar';
import { NavTabs, type TabId } from '@/components/layout/NavTabs';
import { AuthPage } from '@/components/auth/AuthPage';
import { PrepTab } from '@/components/tabs/PrepTab';
import { PaywallPage } from '@/components/auth/PaywallPage';
import { useSubscription } from '@/hooks/use-subscription';
import { isAdmin } from '@/lib/billing';
import { LiveCoachTab } from '@/components/tabs/LiveCoachTab';
import { ObjectionVaultTab } from '@/components/tabs/ObjectionVaultTab';
import { DebriefTab } from '@/components/tabs/DebriefTab';
import { CoachingProfileTab } from '@/components/tabs/CoachingProfileTab';
import { TeamDashboardTab } from '@/components/tabs/TeamDashboardTab';
import { SettingsTab } from '@/components/tabs/SettingsTab';
import { CreditPackModal } from '@/components/ui/CreditPackModal';
import { ToastContainer, useToastRegistry } from '@/components/ui/AppToast';

interface SavedSession {
  id: string;
  objective: string;
  duration_seconds: number;
  created_at: string;
  transcript: TranscriptEntry[];
  coach_cards: CoachCard[];
  score?: number;
  sentiment?: number;
  talk_ratio?: number;
}

export default function App() {
  const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

  // ── Toast ──────────────────────────────────────────────────────────────
  const { toasts, remove } = useToastRegistry();

  // ── Auth ──────────────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  const [session, setSession] = useState<{ user: { email?: string; id?: string } } | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const subStatus = useSubscription(session?.user?.id, session?.user?.email);
  const [authMessage, setAuthMessage] = useState('');

  // ── Navigation ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('prep');

  // ── Prep state ────────────────────────────────────────────────────────
  const [prospectName, setProspectName] = useState('');
  const [prospectCompany, setProspectCompany] = useState('');
  const [prospectRole, setProspectRole] = useState('');
  const [prospectContext, setProspectContext] = useState('');
  const [objective, setObjective] = useState('Book a product demo with a qualified lead');
  const [talkingPoints, setTalkingPoints] = useState<string[]>(initialTalkingPoints);
  const [objections, setObjections] = useState<Objection[]>(initialObjections);

  // ── Live session state ────────────────────────────────────────────────
  const [sessionLive, setSessionLive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [coachCards, setCoachCards] = useState<CoachCard[]>([]);
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [userSentiment, setUserSentiment] = useState(50);
  const [prospectSentiment, setProspectSentiment] = useState(50);

  // ── Event thinking state ──────────────────────────────────────────────
  const [eventThinking, setEventThinking] = useState(false);

  // ── Credit modal ──────────────────────────────────────────────────────
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditModalType, setCreditModalType] = useState('');

  // ── Persistence state ─────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SavedSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [lastSavedSessionId, setLastSavedSessionId] = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSecondsRef = useRef(0);
  const talkingPointsRef = useRef(talkingPoints);
  const sessionRef = useRef(session);
  const eventInFlightRef = useRef(false);
  const talkRatioWarnFiredRef = useRef(false);

  useEffect(() => { talkingPointsRef.current = talkingPoints; }, [talkingPoints]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // ── Deepgram / Web Speech hook ────────────────────────────────────────
  useDeepgram({
    sessionLive,
    talkingPoints,
    objections,
    formatTime,
    timerSecondsRef,
    onTranscript: (entry) => setTranscriptEntries((prev) => [...prev, entry]),
    onInterim: setInterimTranscript,
    onMicStatus: setMicStatus,
    onUserSentiment: setUserSentiment,
    onProspectSentiment: setProspectSentiment,
    onEventTrigger: handleEventTrigger,
  });

  // ── Derived values ────────────────────────────────────────────────────
  const sentiment = useMemo(() => analyzeSentiment(transcriptEntries), [transcriptEntries]);
  const talkRatio = useMemo(() => calculateTalkRatio(transcriptEntries), [transcriptEntries]);
  const questionCount = useMemo(
    () => transcriptEntries.filter((e) => e.text.includes('?')).length,
    [transcriptEntries]
  );
  const liveScore = useMemo(
    () => calculateLiveScore({ talkRatio, sentiment, questionCount, elapsedSeconds: timerSeconds }),
    [talkRatio, sentiment, questionCount, timerSeconds]
  );

  // ── Talk ratio warning ────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionLive) { talkRatioWarnFiredRef.current = false; return; }
    if (talkRatio > 60 && !talkRatioWarnFiredRef.current && transcriptEntries.length > 3) {
      talkRatioWarnFiredRef.current = true;
      handleEventTrigger({
        type: 'talk-ratio-warning',
        timestamp: formatTime(timerSecondsRef.current),
      });
    }
    if (talkRatio <= 55) talkRatioWarnFiredRef.current = false;
  }, [talkRatio, sessionLive, transcriptEntries.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth effect ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setDemoMode(true);
      setAuthChecked(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession({ user: { email: data.session.user.email, id: data.session.user.id } });
      }
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ? { user: { email: s.user.email, id: s.user.id } } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      loadWorkspace(session.user.id);
      loadSessionHistory(session.user.id);
    }
  }, [session?.user?.id]);

  // ── Supabase data ─────────────────────────────────────────────────────
  async function loadWorkspace(userId: string) {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('call_workspaces')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const ws = data[0];
        setWorkspaceId(ws.id);
        if (ws.objective) setObjective(ws.objective);
        if (Array.isArray(ws.talking_points) && ws.talking_points.length > 0) setTalkingPoints(ws.talking_points);
        if (Array.isArray(ws.objections) && ws.objections.length > 0) setObjections(ws.objections);
        if (ws.prospect_info) {
          setProspectName(ws.prospect_info.name || '');
          setProspectCompany(ws.prospect_info.company || '');
          setProspectRole(ws.prospect_info.role || '');
          setProspectContext(ws.prospect_info.context || '');
        }
      }
    } catch {}
  }

  async function loadSessionHistory(userId: string) {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setSessionHistory(data as SavedSession[]);
    } catch {}
  }

  async function handleSaveWorkspace() {
    if (!supabase || !session?.user?.id) return;
    setSaving(true);
    const payload = {
      user_id: session.user.id,
      objective,
      talking_points: talkingPoints,
      objections,
      prospect_info: { name: prospectName, company: prospectCompany, role: prospectRole, context: prospectContext },
      updated_at: new Date().toISOString(),
    };
    try {
      if (workspaceId) {
        await supabase.from('call_workspaces').update(payload).eq('id', workspaceId);
      } else {
        const { data } = await supabase.from('call_workspaces').insert(payload).select().single();
        if (data) setWorkspaceId(data.id);
      }
    } catch {}
    setSaving(false);
  }

  async function handleSaveSession() {
    if (!supabase || !session?.user?.id) return;
    setSavingSession(true);
    try {
      const { data } = await supabase.from('call_sessions').insert({
        user_id: session.user.id,
        workspace_id: workspaceId,
        objective,
        transcript: transcriptEntries,
        coach_cards: coachCards,
        duration_seconds: timerSecondsRef.current,
        score: liveScore,
        sentiment,
        talk_ratio: talkRatio,
        created_at: new Date().toISOString(),
      }).select().single();
      if (data?.id) setLastSavedSessionId(data.id);
      if (session?.user?.id) await loadSessionHistory(session.user.id);
    } catch {}
    setSavingSession(false);
  }

  async function handleSignOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setDemoMode(false);
    setActiveTab('prep');
    stopSession();
  }

  // ── Session control ───────────────────────────────────────────────────
  function startSession() {
    if (sessionLive) return;
    setTranscriptEntries([]);
    setCoachCards([]);
    setInterimTranscript('');
    setUserSentiment(50);
    setProspectSentiment(50);
    timerSecondsRef.current = 0;
    setTimerSeconds(0);
    setSessionLive(true);

    timerRef.current = setInterval(() => {
      timerSecondsRef.current += 1;
      setTimerSeconds(timerSecondsRef.current);
    }, 1000);
  }

  function stopSession() {
    setSessionLive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setInterimTranscript('');
  }

  // ── Event-triggered coaching (free — no credits consumed) ─────────────
  async function handleEventTrigger(trigger: EventTrigger) {
    if (eventInFlightRef.current) return;
    eventInFlightRef.current = true;

    // 1. Decision engine — the brain before Claude
    const decision = decideAction({
      triggerType: trigger.type,
      talkRatio,
      prospectSentiment,
      elapsedSeconds: timerSecondsRef.current,
      utterance: trigger.utterance,
    });

    // 2. Instant heuristic card — appears immediately
    const ts = trigger.timestamp || formatTime(timerSecondsRef.current);
    const heuristicCards = buildHeuristicCoachCards({
      latestUtterance: trigger.utterance || '',
      objections,
      talkingPoints: talkingPointsRef.current,
      elapsedSeconds: timerSecondsRef.current,
      timestamp: ts,
    });
    if (heuristicCards.length > 0) {
      setCoachCards((prev) => dedupeCards([...heuristicCards, ...prev]).slice(0, 25));
    }

    // 3a. Instant-only signals — decision engine says skip Claude
    if (decision.type === 'WARNING' || decision.type === 'TIP') {
      if (decision.message && heuristicCards.length === 0) {
        const instantCard: CoachCard = {
          type: decision.type === 'WARNING' ? 'Warning' : 'Tip',
          tone: decision.type === 'WARNING' ? 'warning' : 'tip',
          trigger: decision.reason,
          text: decision.message,
          timestamp: ts,
        };
        setCoachCards((prev) => dedupeCards([instantCard, ...prev]).slice(0, 25));
      }
      setTimeout(() => { eventInFlightRef.current = false; }, 2000);
      return;
    }

    // 3b. NONE — nothing actionable
    if (decision.type === 'NONE') {
      setTimeout(() => { eventInFlightRef.current = false; }, 2000);
      return;
    }

    // 3c. ESCALATE_AI — call Claude for complex/high-value moments
    setEventThinking(true);
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'event-coach',
          triggerType: trigger.type,
          utterance: trigger.utterance,
          competitor: trigger.competitor,
          elapsedSeconds: timerSecondsRef.current,
          talkingPoints: talkingPointsRef.current,
          userId: sessionRef.current?.user?.id,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        const ts = trigger.timestamp || formatTime(timerSecondsRef.current);
        const cards: CoachCard[] = data.cards.map((c: Partial<CoachCard>) => ({
          type: c.type || 'Warning',
          tone: c.tone || 'warning',
          trigger: c.trigger || trigger.type,
          text: c.text || '',
          timestamp: ts,
          competitor: trigger.competitor,
        }));
        setCoachCards((prev) => dedupeCards([...cards, ...prev]).slice(0, 25));
      }
    } catch {
      // Event coaching is best-effort
    } finally {
      // Keep indicator visible for at least 1.5s so the user sees it
      setTimeout(() => {
        setEventThinking(false);
        setTimeout(() => { eventInFlightRef.current = false; }, 2500);
      }, 1500);
    }
  }

  function handleAddManualTip() {
    const ts = formatTime(timerSecondsRef.current);
    const tip: CoachCard = {
      type: 'Tip',
      tone: 'tip',
      trigger: 'manual addition',
      text: "Review your top talking point and reconnect the conversation to the prospect's stated goal.",
      timestamp: ts,
    };
    setCoachCards((prev) => [tip, ...prev]);
  }

  function handleReplaySession(s: SavedSession) {
    setSelectedSessionId(s.id);
    if (Array.isArray(s.transcript)) setTranscriptEntries(s.transcript);
    if (Array.isArray(s.coach_cards)) setCoachCards(s.coach_cards);
    if (s.duration_seconds) {
      timerSecondsRef.current = s.duration_seconds;
      setTimerSeconds(s.duration_seconds);
    }
    setActiveTab('debrief');
  }

  // ── Access control ────────────────────────────────────────────────────
  const isAuthenticated = demoMode || !!session;
  const hasAccess = demoMode || isAdmin(session?.user?.email) || subStatus === 'active' || subStatus === 'admin';

  if (!authChecked) {
    return (
      <div className="dark min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'prep' as TabId, label: 'Prep' },
    { id: 'live' as TabId, label: 'Live', badge: sessionLive ? coachCards.length : undefined },
    { id: 'vault' as TabId, label: 'Vault', badge: objections.length },
    { id: 'debrief' as TabId, label: 'Debrief' },
    { id: 'profile' as TabId, label: 'Profile' },
    { id: 'team' as TabId, label: 'Team' },
    { id: 'settings' as TabId, label: 'Settings' },
  ];

  if (!isAuthenticated) {
    return (
      <Router base={basePath}>
        <Route path="/">
          <div className="dark min-h-screen">
            <AuthPage
              onDemoMode={() => setDemoMode(true)}
              message={authMessage}
              setMessage={setAuthMessage}
            />
          </div>
        </Route>
      </Router>
    );
  }

  if (isAuthenticated && !hasAccess && subStatus !== 'loading') {
    return (
      <Router base={basePath}>
        <Route path="/">
          <div className="dark min-h-screen" style={{ background: '#080808' }}>
            <PaywallPage
              userEmail={session?.user?.email || ''}
              onSignOut={handleSignOut}
            />
          </div>
        </Route>
      </Router>
    );
  }

  return (
    <Router base={basePath}>
      <Route path="/">
        <div className="dark h-screen flex flex-col overflow-hidden" style={{ background: '#080808' }}>
          <TopBar
            session={session}
            sessionLive={sessionLive}
            timerSeconds={timerSeconds}
            onSignOut={handleSignOut}
            saving={saving}
            savingSession={savingSession}
            onSaveWorkspace={handleSaveWorkspace}
            onSaveSession={handleSaveSession}
          />

          <main className="flex-1 flex flex-col overflow-hidden">
            <div key={activeTab} className="flex-1 flex flex-col overflow-hidden animate-tab-in">
              {activeTab === 'prep' && (
                <PrepTab
                  objective={objective}
                  setObjective={setObjective}
                  talkingPoints={talkingPoints}
                  setTalkingPoints={setTalkingPoints}
                  objections={objections}
                  setObjections={setObjections}
                  supportsSpeech={micStatus !== 'unsupported'}
                  prospectName={prospectName}
                  setProspectName={setProspectName}
                  prospectCompany={prospectCompany}
                  setProspectCompany={setProspectCompany}
                  prospectRole={prospectRole}
                  setProspectRole={setProspectRole}
                  prospectContext={prospectContext}
                  setProspectContext={setProspectContext}
                  userId={session?.user?.id}
                  onCreditsExhausted={(type) => { setCreditModalType(type); setShowCreditModal(true); }}
                />
              )}
              {activeTab === 'live' && (
                <LiveCoachTab
                  sessionLive={sessionLive}
                  micStatus={micStatus}
                  supportsSpeech={micStatus !== 'unsupported'}
                  transcriptEntries={transcriptEntries}
                  interimTranscript={interimTranscript}
                  coachCards={coachCards}
                  talkingPoints={talkingPoints}
                  sentiment={sentiment}
                  userSentiment={userSentiment}
                  prospectSentiment={prospectSentiment}
                  liveScore={liveScore}
                  talkRatio={talkRatio}
                  questionCount={questionCount}
                  timerSeconds={timerSeconds}
                  userId={session?.user?.id}
                  eventThinking={eventThinking}
                  onEventTrigger={(type) => handleEventTrigger({ type: type as import('@/lib/useDeepgram').EventTrigger['type'], timestamp: formatTime(timerSecondsRef.current) })}
                  onStartSession={startSession}
                  onStopSession={stopSession}
                  onAddManualTip={handleAddManualTip}
                  onSaveSnapshot={handleSaveSession}
                  onAiCards={(cards) => setCoachCards((prev) => dedupeCards([...cards, ...prev]).slice(0, 25))}
                  onCreditsExhausted={(type) => { setCreditModalType(type); setShowCreditModal(true); }}
                  savingSession={savingSession}
                />
              )}
              {activeTab === 'vault' && (
                <ObjectionVaultTab
                  objections={objections}
                  setObjections={setObjections}
                />
              )}
              {activeTab === 'debrief' && (
                <DebriefTab
                  transcript={transcriptEntries}
                  coachCards={coachCards}
                  score={liveScore}
                  sentiment={sentiment}
                  talkRatio={talkRatio}
                  duration={timerSeconds}
                  objective={objective}
                  objections={objections}
                  sessionHistory={sessionHistory}
                  onReplay={handleReplaySession}
                  selectedSessionId={selectedSessionId}
                  sessionId={lastSavedSessionId ?? undefined}
                  userId={session?.user?.id}
                  onCreditsExhausted={(type) => { setCreditModalType(type); setShowCreditModal(true); }}
                />
              )}
              {activeTab === 'profile' && (
                <CoachingProfileTab
                  sessionHistory={sessionHistory}
                  currentScore={liveScore}
                  currentSentiment={sentiment}
                  currentTalkRatio={talkRatio}
                />
              )}
              {activeTab === 'team' && (
                <TeamDashboardTab
                  userId={session?.user?.id}
                  userEmail={session?.user?.email}
                />
              )}
              {activeTab === 'settings' && (
                <SettingsTab
                  userId={session?.user?.id}
                  userEmail={session?.user?.email}
                  onSignOut={handleSignOut}
                  onOpenCreditModal={() => { setCreditModalType('interval'); setShowCreditModal(true); }}
                />
              )}
            </div>
          </main>

          <NavTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />

          {showCreditModal && (
            <CreditPackModal
              userId={session?.user?.id ?? ''}
              userEmail={session?.user?.email}
              creditType={creditModalType}
              onClose={() => setShowCreditModal(false)}
            />
          )}

          <ToastContainer toasts={toasts} onRemove={remove} />
        </div>
      </Route>
    </Router>
  );
}
