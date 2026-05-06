import { useState, useEffect, useRef, useMemo } from 'react';
import { Router, Route } from 'wouter';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  analyzeSentiment,
  calculateTalkRatio,
  calculateLiveScore,
  buildHeuristicCoachCards,
  formatTime,
  dedupeCards,
  initialObjections,
  initialTalkingPoints,
  initialCoachCards,
  type CoachCard,
  type Objection,
  type TranscriptEntry,
} from '@/lib/coach';
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

  const [authChecked, setAuthChecked] = useState(false);
  const [session, setSession] = useState<{ user: { email?: string; id?: string } } | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const subStatus = useSubscription(session?.user?.id, session?.user?.email);
  const [authMessage, setAuthMessage] = useState('');

  const [activeTab, setActiveTab] = useState<TabId>('prep');

  const [prospectName, setProspectName] = useState('');
  const [prospectCompany, setProspectCompany] = useState('');
  const [prospectRole, setProspectRole] = useState('');
  const [prospectContext, setProspectContext] = useState('');
  const [objective, setObjective] = useState('Book a product demo with a qualified lead');
  const [talkingPoints, setTalkingPoints] = useState<string[]>(initialTalkingPoints);
  const [objections, setObjections] = useState<Objection[]>(initialObjections);

  const [sessionLive, setSessionLive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [coachCards, setCoachCards] = useState<CoachCard[]>(initialCoachCards);
  const [micStatus, setMicStatus] = useState<'idle' | 'listening' | 'blocked' | 'unsupported' | 'error'>('idle');
  const [supportsSpeech, setSupportsSpeech] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SavedSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSecondsRef = useRef(0);
  const lastCardTimestampRef = useRef('');
  const objectionsRef = useRef(objections);
  const talkingPointsRef = useRef(talkingPoints);

  useEffect(() => { objectionsRef.current = objections; }, [objections]);
  useEffect(() => { talkingPointsRef.current = talkingPoints; }, [talkingPoints]);

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

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupportsSpeech(!!SR);

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
      await supabase.from('call_sessions').insert({
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
      });
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

  function startSession() {
    if (sessionLive) return;
    setSessionLive(true);
    timerSecondsRef.current = 0;
    setTimerSeconds(0);

    timerRef.current = setInterval(() => {
      timerSecondsRef.current += 1;
      setTimerSeconds(timerSecondsRef.current);
    }, 1000);

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicStatus('unsupported');
      return;
    }

    shouldRestartRef.current = true;
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setMicStatus('listening');
    recognition.onerror = (e: Event) => {
      const errEvent = e as Event & { error?: string };
      if (errEvent.error === 'not-allowed') {
        setMicStatus('blocked');
        shouldRestartRef.current = false;
      } else {
        setMicStatus('error');
      }
    };

    recognition.onend = () => {
      setMicStatus('idle');
      if (shouldRestartRef.current) {
        setTimeout(() => {
          if (shouldRestartRef.current) {
            try { recognitionRef.current?.start(); } catch {}
          }
        }, 300);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      if (finalText.trim()) {
        const ts = formatTime(timerSecondsRef.current);
        const entry: TranscriptEntry = { speaker: 'You', text: finalText.trim(), timestamp: ts };
        setTranscriptEntries((prev) => [...prev, entry]);

        if (ts !== lastCardTimestampRef.current) {
          lastCardTimestampRef.current = ts;
          const newCards = buildHeuristicCoachCards({
            latestUtterance: finalText.trim(),
            objections: objectionsRef.current,
            talkingPoints: talkingPointsRef.current,
            elapsedSeconds: timerSecondsRef.current,
            timestamp: ts,
          });
          if (newCards.length > 0) {
            setCoachCards((prev) => dedupeCards([...newCards, ...prev]).slice(0, 20));
          }
        }
      }
    };

    try {
      recognition.start();
    } catch {
      setMicStatus('error');
    }
  }

  function stopSession() {
    setSessionLive(false);
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setMicStatus('idle');
    setInterimTranscript('');
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
    { id: 'live' as TabId, label: 'Live Coach', badge: sessionLive ? coachCards.length : undefined },
    { id: 'vault' as TabId, label: 'Objection Vault', badge: objections.length },
    { id: 'debrief' as TabId, label: 'Debrief' },
    { id: 'profile' as TabId, label: 'Coaching Profile' },
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

  // Show paywall if signed in but no active subscription
  if (isAuthenticated && !hasAccess && subStatus !== 'loading') {
    return (
      <Router base={basePath}>
        <Route path="/">
          <div className="dark min-h-screen" style={{background:'#080808'}}>
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
        <div className="dark min-h-screen flex flex-col">
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
          <NavTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />
          <main className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 'prep' && (
              <PrepTab
                objective={objective}
                setObjective={setObjective}
                talkingPoints={talkingPoints}
                setTalkingPoints={setTalkingPoints}
                objections={objections}
                setObjections={setObjections}
                supportsSpeech={supportsSpeech}
                prospectName={prospectName}
                setProspectName={setProspectName}
                prospectCompany={prospectCompany}
                setProspectCompany={setProspectCompany}
                prospectRole={prospectRole}
                setProspectRole={setProspectRole}
                prospectContext={prospectContext}
                setProspectContext={setProspectContext}
              />
            )}
            {activeTab === 'live' && (
              <LiveCoachTab
                sessionLive={sessionLive}
                micStatus={micStatus}
                supportsSpeech={supportsSpeech}
                transcriptEntries={transcriptEntries}
                interimTranscript={interimTranscript}
                coachCards={coachCards}
                talkingPoints={talkingPoints}
                sentiment={sentiment}
                liveScore={liveScore}
                talkRatio={talkRatio}
                questionCount={questionCount}
                onStartSession={startSession}
                onStopSession={stopSession}
                onAddManualTip={handleAddManualTip}
                onSaveSnapshot={handleSaveSession}
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
          </main>
        </div>
      </Route>
    </Router>
  );
}
