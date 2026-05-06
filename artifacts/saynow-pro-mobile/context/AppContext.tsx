import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Outcome = 'closed' | 'follow_up' | 'no_interest' | 'voicemail';

export interface CoachCard {
  id: string;
  type: string;
  tone: string;
  trigger: string;
  text: string;
  timestamp: string;
}

export interface NoteEntry {
  id: string;
  text: string;
  timestamp: string;
}

export interface Session {
  id: string;
  objective: string;
  duration: number;
  notes: NoteEntry[];
  coachCards: CoachCard[];
  outcome?: Outcome;
  score?: number;
  createdAt: string;
}

interface Prefs {
  prospectName: string;
  prospectCompany: string;
  prospectRole: string;
  objective: string;
  talkingPoints: string[];
}

interface AppContextValue extends Prefs {
  setProspectName: (v: string) => void;
  setProspectCompany: (v: string) => void;
  setProspectRole: (v: string) => void;
  setObjective: (v: string) => void;
  setTalkingPoints: (v: string[]) => void;
  sessions: Session[];
  addSession: (s: Session) => void;
  updateSession: (id: string, patch: Partial<Session>) => void;
  deleteSession: (id: string) => void;
  prefsLoaded: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

const PREFS_KEY = 'saynow_prefs_v1';
const SESSIONS_KEY = 'saynow_sessions_v1';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [prospectName, setProspectName] = useState('');
  const [prospectCompany, setProspectCompany] = useState('');
  const [prospectRole, setProspectRole] = useState('');
  const [objective, setObjective] = useState('Book a product demo with a qualified lead');
  const [talkingPoints, setTalkingPoints] = useState<string[]>([
    'ROI within 90 days',
    'No IT lift required',
    '24/7 support included',
  ]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load persisted data
  useEffect(() => {
    async function load() {
      try {
        const [prefsRaw, sessionsRaw] = await Promise.all([
          AsyncStorage.getItem(PREFS_KEY),
          AsyncStorage.getItem(SESSIONS_KEY),
        ]);
        if (prefsRaw) {
          const p: Partial<Prefs> = JSON.parse(prefsRaw);
          if (p.prospectName !== undefined) setProspectName(p.prospectName);
          if (p.prospectCompany !== undefined) setProspectCompany(p.prospectCompany);
          if (p.prospectRole !== undefined) setProspectRole(p.prospectRole);
          if (p.objective !== undefined) setObjective(p.objective);
          if (Array.isArray(p.talkingPoints)) setTalkingPoints(p.talkingPoints);
        }
        if (sessionsRaw) {
          const s: Session[] = JSON.parse(sessionsRaw);
          if (Array.isArray(s)) setSessions(s);
        }
      } catch {}
      setPrefsLoaded(true);
    }
    load();
  }, []);

  // Persist prefs on change
  useEffect(() => {
    if (!prefsLoaded) return;
    const prefs: Prefs = { prospectName, prospectCompany, prospectRole, objective, talkingPoints };
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
  }, [prospectName, prospectCompany, prospectRole, objective, talkingPoints, prefsLoaded]);

  // Persist sessions on change
  useEffect(() => {
    if (!prefsLoaded) return;
    AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)).catch(() => {});
  }, [sessions, prefsLoaded]);

  const addSession = useCallback((s: Session) => {
    setSessions((prev) => [s, ...prev].slice(0, 50));
  }, []);

  const updateSession = useCallback((id: string, patch: Partial<Session>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <AppContext.Provider
      value={{
        prospectName, setProspectName,
        prospectCompany, setProspectCompany,
        prospectRole, setProspectRole,
        objective, setObjective,
        talkingPoints, setTalkingPoints,
        sessions, addSession, updateSession, deleteSession,
        prefsLoaded,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
