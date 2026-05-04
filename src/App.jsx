import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { buildHeuristicCoachCards, requestCoachSuggestions } from './lib/coach';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const coachWebhookUrl = import.meta.env.VITE_COACH_WEBHOOK_URL;
const coachWebhookBearer = import.meta.env.VITE_COACH_WEBHOOK_BEARER;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const initialObjections = [
  {
    question: 'We already have a vendor.',
    answer: 'That makes sense. If you could improve one part of your current workflow, what would it be?',
    category: 'Competition'
  },
  {
    question: 'Your pricing seems high.',
    answer: 'Totally fair. Teams usually justify the cost by reducing manual follow-up time and improving close rate.',
    category: 'Pricing'
  }
];

const initialTalkingPoints = [
  'Open with their current process and pain points.',
  'Position the pilot as low-risk and easy to measure.'
];

const initialCoachCards = [
  {
    type: 'Tip',
    tone: 'tip',
    trigger: 'opening guidance',
    text: 'Open with their current workflow and one measurable outcome you can improve.',
    quote: 'What part of your current process is costing the team the most time?',
    timestamp: '00:00'
  }
];

function formatTime(totalSeconds) {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatCreatedAt(isoString) {
  if (!isoString) return 'Unknown date';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

function dedupeCards(cards) {
  const seen = new Set();
  return cards.filter(card => {
    const key = `${card.type}-${card.trigger}-${card.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function App() {
  const [activeTab, setActiveTab] = useState('prep');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [session, setSession] = useState(null);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [objective, setObjective] = useState('Book a product demo with a qualified lead');
  const [talkingPoints, setTalkingPoints] = useState(initialTalkingPoints);
  const [objections, setObjections] = useState(initialObjections);
  const [tpInput, setTpInput] = useState('');
  const [objQuestion, setObjQuestion] = useState('');
  const [objAnswer, setObjAnswer] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [sessionLive, setSessionLive] = useState(false);
  const [supportsSpeech, setSupportsSpeech] = useState(false);
  const [micStatus, setMicStatus] = useState('idle');
  const [coachStatus, setCoachStatus] = useState(coachWebhookUrl ? 'Webhook ready' : 'Heuristic mode');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [transcriptEntries, setTranscriptEntries] = useState([]);
  const [coachCards, setCoachCards] = useState(initialCoachCards);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const recognitionRef = useRef(null);
  const timerSecondsRef = useRef(0);
  const liveStateRef = useRef(false);
  const manualStopRef = useRef(false);
  const coachAbortRef = useRef(null);
  const lastAnalyzedUtteranceRef = useRef('');

  useEffect(() => {
    timerSecondsRef.current = timerSeconds;
  }, [timerSeconds]);

  useEffect(() => {
    liveStateRef.current = sessionLive;
  }, [sessionLive]);

  useEffect(() => {
    if (!supabase) {
      setMessage('Add your Supabase URL and anon key to .env before using auth or cloud save.');
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setMessage(error.message);
        return;
      }
      setSession(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupportsSpeech(false);
      setMicStatus('unsupported');
      return undefined;
    }

    setSupportsSpeech(true);
    setMicStatus('idle');

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setMicStatus('listening');
    };

    recognition.onresult = event => {
      let interim = '';
      const freshFinalEntries = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;

        if (result.isFinal) {
          freshFinalEntries.push({
            speaker: 'Call',
            text,
            timestamp: formatTime(timerSecondsRef.current)
          });
        } else {
          interim += `${text} `;
        }
      }

      setInterimTranscript(interim.trim());
      if (freshFinalEntries.length > 0) {
        setTranscriptEntries(prev => [...prev, ...freshFinalEntries]);
      }
    };

    recognition.onerror = event => {
      if (event.error === 'not-allowed') {
        setMicStatus('blocked');
        setMessage('Microphone permission was blocked. Allow mic access and try again.');
        return;
      }
      if (event.error === 'no-speech') return;
      setMicStatus('error');
      setMessage(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (liveStateRef.current && !manualStopRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          setMicStatus('idle');
          return;
        }
      }
      setMicStatus(supportsSpeech ? 'idle' : 'unsupported');
    };

    recognitionRef.current = recognition;

    return () => {
      manualStopRef.current = true;
      try {
        recognition.stop();
      } catch {
        // no-op cleanup
      }
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!session?.user || !supabase) {
      setWorkspaceId(null);
      setSessionHistory([]);
      setSelectedSessionId(null);
      return;
    }

    void loadWorkspace(session.user.id);
    void loadSessionHistory(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!sessionLive) return undefined;
    const timer = window.setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionLive]);

  useEffect(() => {
    const latest = transcriptEntries.at(-1);
    if (!latest || lastAnalyzedUtteranceRef.current === latest.text) return;

    lastAnalyzedUtteranceRef.current = latest.text;
    const timestamp = latest.timestamp || formatTime(timerSecondsRef.current);

    const heuristicCards = buildHeuristicCoachCards({
      latestUtterance: latest.text,
      objections,
      talkingPoints,
      elapsedSeconds: timerSecondsRef.current,
      timestamp
    });

    if (heuristicCards.length > 0) {
      setCoachCards(prev => dedupeCards([...heuristicCards, ...prev]));
    }

    if (!coachWebhookUrl) {
      setCoachStatus('Heuristic mode');
      return;
    }

    coachAbortRef.current?.abort();
    const controller = new AbortController();
    coachAbortRef.current = controller;
    setCoachStatus('Analyzing live transcript');

    void requestCoachSuggestions({
      endpoint: coachWebhookUrl,
      bearerToken: coachWebhookBearer,
      payload: {
        objective,
        latestUtterance: latest.text,
        transcript: transcriptEntries,
        elapsedSeconds: timerSecondsRef.current,
        talkingPoints,
        objections
      },
      signal: controller.signal,
      fallbackTimestamp: timestamp
    })
      .then(remoteCards => {
        if (remoteCards.length > 0) {
          setCoachCards(prev => dedupeCards([...remoteCards, ...prev]));
        }
        setCoachStatus('Webhook connected');
      })
      .catch(error => {
        if (error.name === 'AbortError') return;
        setCoachStatus('Webhook unavailable, using heuristics');
      });
  }, [transcriptEntries, objective, objections, talkingPoints]);

  async function loadWorkspace(userId) {
    if (!supabase) return;
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('call_workspaces')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    if (data) {
      setWorkspaceId(data.id);
      setObjective(data.objective || '');
      setTalkingPoints(Array.isArray(data.talking_points) ? data.talking_points : initialTalkingPoints);
      setObjections(Array.isArray(data.objections) ? data.objections : initialObjections);
      setLoading(false);
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('call_workspaces')
      .insert({
        user_id: userId,
        objective,
        talking_points: initialTalkingPoints,
        objections: initialObjections
      })
      .select('*')
      .single();

    setLoading(false);

    if (insertError) {
      setMessage(insertError.message);
      return;
    }

    setWorkspaceId(inserted.id);
    setMessage('Workspace created.');
  }

  async function loadSessionHistory(userId) {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSessionHistory(Array.isArray(data) ? data : []);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabase) {
      setMessage('Missing Supabase environment variables.');
      return;
    }

    setLoading(true);
    setMessage('');

    const action = authMode === 'signup'
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password });

    const { error } = await action;
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(authMode === 'signup'
      ? 'Account created. Check your email if confirmation is enabled.'
      : 'Signed in successfully.');
    setEmail('');
    setPassword('');
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Signed out.');
  }

  async function saveWorkspace() {
    if (!supabase || !session?.user) {
      setMessage('Sign in before saving to Supabase.');
      return;
    }

    setSaving(true);
    setMessage('');

    const payload = {
      user_id: session.user.id,
      objective,
      talking_points: talkingPoints,
      objections
    };

    const query = workspaceId
      ? supabase.from('call_workspaces').update(payload).eq('id', workspaceId)
      : supabase.from('call_workspaces').insert(payload);

    const { data, error } = await query.select('*').single();
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.id) setWorkspaceId(data.id);
    setMessage('Saved to Supabase.');
  }

  async function saveSessionSnapshot() {
    if (!supabase || !session?.user) {
      setMessage('Sign in before saving session snapshots.');
      return;
    }

    setSavingSession(true);
    setMessage('');

    const { error } = await supabase.from('call_sessions').insert({
      user_id: session.user.id,
      workspace_id: workspaceId,
      objective,
      transcript: transcriptEntries,
      coach_cards: coachCards,
      duration_seconds: timerSeconds
    });

    setSavingSession(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadSessionHistory(session.user.id);
    setMessage('Session snapshot saved.');
  }

  function addTalkingPoint() {
    const value = tpInput.trim();
    if (!value) return;
    setTalkingPoints(prev => [...prev, value]);
    setTpInput('');
  }

  function deleteTalkingPoint(index) {
    setTalkingPoints(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function addObjection() {
    const question = objQuestion.trim();
    const answer = objAnswer.trim();
    if (!question || !answer) return;
    setObjections(prev => [{ question, answer, category: 'Custom' }, ...prev]);
    setObjQuestion('');
    setObjAnswer('');
  }

  function deleteObjection(index) {
    setObjections(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function startLiveSession() {
    setMessage('');
    setSessionLive(true);
    manualStopRef.current = false;

    if (!recognitionRef.current) {
      setMicStatus('unsupported');
      setMessage('Speech recognition is not available in this browser. Use Chrome or Edge for live transcript capture.');
      return;
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      }
      recognitionRef.current.start();
      setMicStatus('listening');
    } catch {
      setMicStatus('blocked');
      setSessionLive(false);
      setMessage('Unable to start microphone capture. Check browser permission settings.');
    }
  }

  function stopLiveSession() {
    manualStopRef.current = true;
    setSessionLive(false);
    setInterimTranscript('');
    coachAbortRef.current?.abort();
    try {
      recognitionRef.current?.stop();
    } catch {
      // no-op
    }
  }

  function addManualCoachCard() {
    setCoachCards(prev => dedupeCards([
      {
        type: 'Response',
        tone: 'response',
        trigger: 'manual prompt',
        text: 'Try: “If we could shorten that process by 30%, would a pilot be worth exploring?”',
        quote: 'Suggested phrasing ready to use on the call.',
        timestamp: formatTime(timerSeconds)
      },
      ...prev
    ]));
  }

  function replaySession(snapshot) {
    setActiveTab('live');
    setSelectedSessionId(snapshot.id);
    setSessionLive(false);
    setInterimTranscript('');
    setTimerSeconds(snapshot.duration_seconds || 0);
    setObjective(snapshot.objective || objective);
    setTranscriptEntries(Array.isArray(snapshot.transcript) ? snapshot.transcript : []);
    setCoachCards(
      Array.isArray(snapshot.coach_cards) && snapshot.coach_cards.length > 0
        ? snapshot.coach_cards
        : initialCoachCards
    );
    lastAnalyzedUtteranceRef.current = '';
  }

  const stats = useMemo(() => ({
    sessionState: sessionLive ? 'LIVE' : 'IDLE',
    questions: transcriptEntries.filter(item => item.text.includes('?')).length,
    tips: coachCards.length,
    objections: objections.length
  }), [coachCards.length, objections.length, sessionLive, transcriptEntries]);

  const selectedSession = useMemo(
    () => sessionHistory.find(item => item.id === selectedSessionId) || null,
    [selectedSessionId, sessionHistory]
  );

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-wrap">
          <img src={`${import.meta.env.BASE_URL}saynow-logo.png`} alt="SayNow Pro logo" className="brand-logo" />
          <div className="brand-copy">
            <div className="brand-name">SayNow <em>Pro</em></div>
            <div className="brand-sub">Live transcript coaching workspace</div>
          </div>
          <div className="brand-badge">Gold Remix Header</div>
        </div>

        <div className="topbar-right">
          <div className={`live-indicator ${sessionLive ? 'on' : ''}`}>
            <span className="live-dot" />
            <span>{sessionLive ? 'Live' : 'Offline'}</span>
          </div>
          <div className="timer-display">{formatTime(timerSeconds)}</div>
        </div>
      </header>

      <section className="auth-strip">
        <form className="auth-form" onSubmit={handleAuthSubmit}>
          <button type="button" className={`mini-btn ${authMode === 'signin' ? 'accent' : ''}`} onClick={() => setAuthMode('signin')}>Sign in</button>
          <button type="button" className={`mini-btn ${authMode === 'signup' ? 'accent' : ''}`} onClick={() => setAuthMode('signup')}>Sign up</button>
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email" autoComplete="email" />
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} />
          <button className="btn btn-cyan" type="submit" disabled={loading}>{loading ? 'Working...' : authMode === 'signup' ? 'Create account' : 'Login'}</button>
          <button className="btn btn-ghost" type="button" onClick={saveWorkspace} disabled={saving || !session}>{saving ? 'Saving...' : 'Save workspace'}</button>
          <button className="btn btn-gold" type="button" onClick={saveSessionSnapshot} disabled={savingSession || !session}>{savingSession ? 'Saving...' : 'Save session'}</button>
          {session && <button className="btn btn-red" type="button" onClick={handleSignOut}>Sign out</button>}
        </form>
        <div className="status-line">
          <span>{session?.user?.email ?? 'Not signed in'}</span>
          <span>{message}</span>
        </div>
      </section>

      <nav className="nav" aria-label="Primary tabs">
        <button className={`nav-tab ${activeTab === 'prep' ? 'active' : ''}`} onClick={() => setActiveTab('prep')}>Prep <span className="nav-badge">{talkingPoints.length}</span></button>
        <button className={`nav-tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Live Coach <span className="nav-badge">{coachCards.length}</span></button>
        <button className={`nav-tab ${activeTab === 'vault' ? 'active' : ''}`} onClick={() => setActiveTab('vault')}>Objection Vault <span className="nav-badge">{objections.length}</span></button>
        <button className={`nav-tab ${activeTab === 'debrief' ? 'active' : ''}`} onClick={() => setActiveTab('debrief')}>Debrief</button>
      </nav>

      <main className="content">
        {activeTab === 'prep' && (
          <section className="tab-panel active">
            <div className="hero-grid">
              <div className="ai-generate-section">
                <div className="ai-generate-header">
                  <div className="card-title no-margin">Call Setup</div>
                  <span className="ai-tag">Production Ready</span>
                </div>
                <div className="field-label">Call objective</div>
                <input value={objective} onChange={event => setObjective(event.target.value)} type="text" placeh
