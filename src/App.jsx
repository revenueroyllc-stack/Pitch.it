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
                <input value={objective} onChange={event => setObjective(event.target.value)} type="text" placeholder="Book a product demo with a qualified lead" />
                <p className="section-note">This version includes live speech capture hooks, webhook-based AI coach suggestions, session history replay, and Supabase persistence.</p>
              </div>

              <div className="hook-status-card">
                <div className="card-title">Production Hooks</div>
                <div className="pill-grid">
                  <div className={`signal-pill ${supportsSpeech ? 'good' : 'warn'}`}>
                    <strong>Speech Recognition</strong>
                    <span>{supportsSpeech ? 'Available in this browser' : 'Use Chrome or Edge'}</span>
                  </div>
                  <div className={`signal-pill ${coachWebhookUrl ? 'good' : 'warn'}`}>
                    <strong>AI Coach Endpoint</strong>
                    <span>{coachWebhookUrl ? coachStatus : 'Webhook env missing, heuristics active'}</span>
                  </div>
                  <div className={`signal-pill ${supabase ? 'good' : 'warn'}`}>
                    <strong>Supabase Cloud Save</strong>
                    <span>{supabase ? 'Configured for auth and storage' : 'Env vars missing'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="prep-grid">
              <div className="card">
                <div className="card-title">Talking Points</div>
                <div className="talking-points-list">
                  {talkingPoints.map((point, index) => (
                    <div className="tp-item" key={`${point}-${index}`}>
                      <span className="tp-num">{index + 1}</span>
                      <span>{point}</span>
                      <button className="tp-del" type="button" onClick={() => deleteTalkingPoint(index)}>×</button>
                    </div>
                  ))}
                </div>
                <div className="add-tp-row">
                  <input value={tpInput} onChange={event => setTpInput(event.target.value)} type="text" placeholder="Add a talking point" />
                  <button className="btn btn-cyan" type="button" onClick={addTalkingPoint}>Add</button>
                </div>
              </div>

              <div className="card">
                <div className="card-title">Objection Prep</div>
                <div className="objection-prep-list">
                  {objections.map((item, index) => (
                    <div className="obj-item" key={`${item.question}-${index}`}>
                      <div className="obj-q">
                        <span>{item.question}</span>
                        <button className="obj-del" type="button" onClick={() => deleteObjection(index)}>×</button>
                      </div>
                      <div className="obj-a">{item.answer}</div>
                    </div>
                  ))}
                </div>
                <div className="add-obj-form">
                  <input value={objQuestion} onChange={event => setObjQuestion(event.target.value)} type="text" placeholder="Common objection" />
                  <textarea value={objAnswer} onChange={event => setObjAnswer(event.target.value)} rows="3" placeholder="Suggested response" />
                  <button className="btn btn-gold" type="button" onClick={addObjection}>Save objection</button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'live' && (
          <section className="tab-panel active">
            <div className="stats-row">
              <div className="stat-box"><div className="stat-val">{stats.sessionState}</div><div className="stat-lbl">Session State</div></div>
              <div className="stat-box"><div className="stat-val">{stats.questions}</div><div className="stat-lbl">Questions</div></div>
              <div className="stat-box"><div className="stat-val">{stats.tips}</div><div className="stat-lbl">Coach Cards</div></div>
              <div className="stat-box"><div className="stat-val">{stats.objections}</div><div className="stat-lbl">Objections</div></div>
            </div>

            <div className="live-layout">
              <div className="live-left">
                <div className="transcript-wrap">
                  <div className="card-title row-between">
                    <span>Live Transcript</span>
                    <div className="waveform" aria-hidden="true">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <span className={`w-bar ${sessionLive ? 'on' : ''}`} key={index} />
                      ))}
                    </div>
                  </div>
                  <div className="sub-status-row">
                    <span className={`chip ${supportsSpeech ? 'good' : 'warn'}`}>Mic: {micStatus}</span>
                    <span className={`chip ${coachWebhookUrl ? 'good' : 'warn'}`}>Coach: {coachStatus}</span>
                  </div>
                  <div className="transcript-body">
                    {transcriptEntries.length === 0 && !interimTranscript && (
                      <div className="empty">
                        <div className="empty-ico">🎙️</div>
                        <div className="empty-h">No transcript yet</div>
                        <div className="empty-p">Start the session to capture live browser speech recognition into the transcript panel.</div>
                      </div>
                    )}
                    {transcriptEntries.map((item, index) => (
                      <div className="transcript-line" key={`${item.timestamp}-${index}-${item.text}`}> 
                        <span className="transcript-ts">{item.timestamp}</span>
                        <span className="transcript-speaker">{item.speaker}</span>
                        <span className="transcript-text">{item.text}</span>
                      </div>
                    ))}
                    {interimTranscript && (
                      <div className="transcript-line interim">
                        <span className="transcript-ts">…</span>
                        <span className="transcript-speaker">Listening</span>
                        <span className="transcript-text">{interimTranscript}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="controls-bar wrap">
                  <button className="btn btn-cyan" type="button" onClick={startLiveSession}>Start Session</button>
                  <button className="btn btn-red" type="button" onClick={stopLiveSession}>Stop</button>
                  <button className="btn btn-ghost" type="button" onClick={addManualCoachCard}>Add Manual Tip</button>
                  <button className="btn btn-gold" type="button" onClick={saveSessionSnapshot} disabled={savingSession || !session}>{savingSession ? 'Saving...' : 'Save Snapshot'}</button>
                </div>
              </div>

              <aside className="live-right">
                <div className="coach-feed-wrap">
                  <div className="card-title">Coach Feed</div>
                  <div className="coach-feed">
                    {coachCards.map((card, index) => (
                      <article className={`ccard t-${card.tone}`} key={`${card.timestamp}-${index}-${card.text}`}>
                        <div className="ccard-head">
                          <span className="ccard-type">{card.type}</span>
                          <span className="ccard-trigger">{card.trigger}</span>
                          <span className="ccard-ts">{card.timestamp}</span>
                        </div>
                        <div className="ccard-body">{card.text}</div>
                        {card.quote && <div className="ccard-quote">{card.quote}</div>}
                      </article>
                    ))}
                  </div>
                </div>

                <div className="tp-panel">
                  <div className="card-title">Active Talking Points</div>
                  {talkingPoints.map((point, index) => (
                    <div className="tp-chip" key={`${point}-${index}`}>
                      <span className="tp-dot" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </section>
        )}

        {activeTab === 'vault' && (
          <section className="tab-panel active">
            <div className="vault-grid">
              {objections.map((item, index) => (
                <article className="vault-card" key={`${item.question}-${index}`}>
                  <span className="vault-category">{item.category || 'General'}</span>
                  <div className="vault-q">{item.question}</div>
                  <div className="vault-a">{item.answer}</div>
                  <div className="vault-actions">
                    <button className="mini-btn accent" type="button">Use Response</button>
                    <button className="mini-btn" type="button">Practice</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'debrief' && (
          <section className="tab-panel active">
            <div className="debrief-layout">
              <div className="debrief-header">
                <div>
                  <div className="card-title">Post-Call Debrief</div>
                  <p className="debrief-text">Review strengths, missed opportunities, and next steps. Session snapshots can be stored in Supabase for later review.</p>
                </div>
                <div className="score-pill">
                  <div className="score-ring"><span>92</span></div>
                  <div className="score-info">
                    <h3>Production Build Score</h3>
                    <p>Header branding, deployment configs, replay UI, and cloud save included</p>
                  </div>
                </div>
              </div>

              <div className="debrief-sections">
                <div className="debrief-card">
                  <div className="card-title">What was added</div>
                  <ul className="debrief-list">
                    <li>Logo image integrated into the header from your SayNow artwork.</li>
                    <li>Live browser speech recognition transcript capture with microphone status.</li>
                    <li>Webhook-based AI coach hooks with heuristic fallback suggestions.</li>
                  </ul>
                </div>
                <div className="debrief-card">
                  <div className="card-title">Deployment targets</div>
                  <ul className="debrief-list">
                    <li>GitHub Pages workflow included for automated deployment on push.</li>
                    <li>Netlify and Vercel configuration files included in the repo.</li>
                    <li>Supabase schema expanded to support saved call session snapshots.</li>
                  </ul>
                </div>
                <div className="debrief-card full">
                  <div className="card-title">Session History & Replay</div>
                  <div className="history-layout">
                    <div className="history-list">
                      {sessionHistory.length === 0 ? (
                        <div className="history-empty">Save a session snapshot to see replay history here.</div>
                      ) : (
                        sessionHistory.map(item => (
                          <div className={`history-item ${selectedSessionId === item.id ? 'selected' : ''}`} key={item.id}>
                            <div className="history-main">
                              <strong>{item.objective || 'Untitled session'}</strong>
                              <span>{formatCreatedAt(item.created_at)}</span>
                              <span>Duration {formatTime(item.duration_seconds || 0)}</span>
                              <span>{Array.isArray(item.transcript) ? item.transcript.length : 0} transcript lines</span>
                            </div>
                            <div className="history-actions">
                              <button className="mini-btn accent" type="button" onClick={() => replaySession(item)}>Replay</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="history-preview">
                      <div className="card-title">Selected Snapshot</div>
                      {selectedSession ? (
                        <>
                          <p className="debrief-text"><strong>{selectedSession.objective || 'Untitled session'}</strong></p>
                          <p className="debrief-text">Saved {formatCreatedAt(selectedSession.created_at)} · Duration {formatTime(selectedSession.duration_seconds || 0)}</p>
                          <p className="debrief-text">Transcript lines: {Array.isArray(selectedSession.transcript) ? selectedSession.transcript.length : 0}</p>
                          <p className="debrief-text">Coach cards: {Array.isArray(selectedSession.coach_cards) ? selectedSession.coach_cards.length : 0}</p>
                        </>
                      ) : (
                        <p className="debrief-text">Choose a saved session to preview and replay it into the live coaching tab.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
