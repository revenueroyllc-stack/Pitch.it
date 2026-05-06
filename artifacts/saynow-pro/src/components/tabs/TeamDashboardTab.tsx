import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface TeamMember {
  user_id: string;
  display_name?: string;
  email?: string;
  role: 'rep' | 'manager' | 'admin';
  avg_score?: number;
  total_calls?: number;
  last_call_at?: string;
}

interface Team {
  id: string;
  name: string;
  code: string;
  admin_id: string;
  seat_limit: number;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

interface TeamDashboardTabProps {
  userId?: string;
  userEmail?: string;
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1" style={{ backdropFilter: 'blur(8px)' }}>
      <p className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-mono font-black text-2xl" style={{ color: color || 'currentColor' }}>{value}</p>
      {sub && <p className="text-[0.62rem] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function roleChip(role: string) {
  const map: Record<string, { label: string; color: string }> = {
    admin:   { label: 'Admin',   color: '#c9960c' },
    manager: { label: 'Manager', color: '#4a90d9' },
    rep:     { label: 'Rep',     color: '#00c896' },
  };
  const { label, color } = map[role] || { label: role, color: '#888' };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[0.58rem] font-mono font-semibold uppercase tracking-wider border"
      style={{ color, borderColor: `${color}40`, background: `${color}10` }}
    >
      {label}
    </span>
  );
}

export function TeamDashboardTab({ userId, userEmail }: TeamDashboardTabProps) {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const isConfigured = isSupabaseConfigured && !!supabase;

  useEffect(() => {
    if (!userId || !isConfigured) { setLoading(false); return; }
    loadTeamData();
    loadNotifications();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTeamData() {
    if (!supabase || !userId) return;
    setLoading(true);
    try {
      // Find team membership
      const { data: memberRow } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', userId)
        .maybeSingle();

      if (!memberRow) { setLoading(false); return; }

      const { data: teamRow } = await supabase
        .from('teams')
        .select('*')
        .eq('id', memberRow.team_id)
        .maybeSingle();

      if (teamRow) setTeam(teamRow);

      // Load all team members with their call stats
      const { data: allMembers } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', memberRow.team_id);

      if (allMembers) {
        const memberIds = allMembers.map((m) => m.user_id);
        const { data: sessions } = await supabase
          .from('call_sessions')
          .select('user_id, score, created_at')
          .in('user_id', memberIds)
          .order('created_at', { ascending: false });

        const statsByUser: Record<string, { scores: number[]; lastCall: string }> = {};
        for (const s of sessions || []) {
          if (!statsByUser[s.user_id]) statsByUser[s.user_id] = { scores: [], lastCall: s.created_at };
          if (typeof s.score === 'number') statsByUser[s.user_id].scores.push(s.score);
        }

        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', memberIds);

        const profileMap: Record<string, string> = {};
        for (const p of profiles || []) profileMap[p.user_id] = p.display_name || '';

        const enriched: TeamMember[] = allMembers.map((m) => {
          const stats = statsByUser[m.user_id];
          const scores = stats?.scores ?? [];
          return {
            user_id: m.user_id,
            role: m.role,
            display_name: profileMap[m.user_id] || (m.user_id === userId ? (userEmail?.split('@')[0] || 'You') : `Rep ${m.user_id.slice(0, 6)}`),
            avg_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : undefined,
            total_calls: sessions?.filter((s) => s.user_id === m.user_id).length ?? 0,
            last_call_at: stats?.lastCall,
          };
        });

        setMembers(enriched.sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0)));
      }
    } catch {
      // Silently degrade
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    if (!supabase || !userId) return;
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setNotifications(data);
    } catch {}
  }

  async function markNotificationRead(id: string) {
    if (!supabase) return;
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {}
  }

  async function handleCreateTeam() {
    if (!teamName.trim() || !supabase || !userId) return;
    setActionLoading(true);
    setActionError('');
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: teamRow, error } = await supabase
        .from('teams')
        .insert({ name: teamName.trim(), code, admin_id: userId })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('team_members').insert({ team_id: teamRow.id, user_id: userId, role: 'admin' });
      await supabase.from('user_profiles').upsert({ user_id: userId, role: 'admin', team_id: teamRow.id });

      setActionSuccess(`Team "${teamRow.name}" created! Join code: ${code}`);
      setShowCreate(false);
      setTeamName('');
      await loadTeamData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleJoinTeam() {
    if (!joinCode.trim() || !supabase || !userId) return;
    setActionLoading(true);
    setActionError('');
    try {
      const { data: teamRow, error } = await supabase
        .from('teams')
        .select('*')
        .eq('code', joinCode.trim().toUpperCase())
        .maybeSingle();
      if (error || !teamRow) throw new Error('Invalid team code. Check with your manager.');

      // Check seat limit
      const { count } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamRow.id);
      if ((count || 0) >= teamRow.seat_limit) throw new Error('This team is at its seat limit.');

      await supabase.from('team_members').insert({ team_id: teamRow.id, user_id: userId, role: 'rep' });
      await supabase.from('user_profiles').upsert({ user_id: userId, role: 'rep', team_id: teamRow.id });

      setActionSuccess(`Joined "${teamRow.name}"!`);
      setShowJoin(false);
      setJoinCode('');
      await loadTeamData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to join team');
    } finally {
      setActionLoading(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const myMember = members.find((m) => m.user_id === userId);
  const myRank = members.findIndex((m) => m.user_id === userId) + 1;

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center gap-3">
        <p className="text-sm text-muted-foreground">Team features require Supabase configuration.</p>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex flex-col gap-4 p-4 pb-10 overflow-auto flex-1" data-testid="team-tab">

      {/* No team — onboarding */}
      {!loading && !team && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 py-16">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl border border-border bg-card flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h2 className="text-xl font-black text-foreground mb-1">Team Coaching</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create a team to share call insights, benchmark reps, and unlock manager coaching notes.
            </p>
          </div>

          {actionSuccess && (
            <div className="px-4 py-3 rounded-xl border border-[rgba(0,200,150,0.3)] bg-[rgba(0,200,150,0.08)] text-sm text-[#00c896]">
              {actionSuccess}
            </div>
          )}

          {actionError && (
            <div className="px-4 py-3 rounded-xl border border-[rgba(255,71,87,0.3)] bg-[rgba(255,71,87,0.08)] text-sm text-[#ff4757]">
              {actionError}
            </div>
          )}

          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={() => { setShowCreate(true); setShowJoin(false); setActionError(''); }}
              className="px-6 py-3 rounded-xl font-bold text-sm text-primary-foreground transition-all hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg, #c9960c, #f5d97e)', color: '#1a0a0a' }}
            >
              Create a Team
            </button>
            <button
              onClick={() => { setShowJoin(true); setShowCreate(false); setActionError(''); }}
              className="px-6 py-3 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            >
              Join with Code
            </button>
          </div>

          {showCreate && (
            <div className="w-full max-w-sm flex flex-col gap-3 p-4 rounded-2xl border border-border bg-card">
              <p className="text-sm font-semibold text-foreground">Create Team</p>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team name (e.g. West Coast Sales)"
                className="px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              <button
                onClick={handleCreateTeam}
                disabled={actionLoading || !teamName.trim()}
                className="px-4 py-2.5 rounded-xl font-bold text-sm text-[#1a0a0a] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #c9960c, #f5d97e)' }}
              >
                {actionLoading ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          )}

          {showJoin && (
            <div className="w-full max-w-sm flex flex-col gap-3 p-4 rounded-2xl border border-border bg-card">
              <p className="text-sm font-semibold text-foreground">Join Team</p>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="6-character code (e.g. AB1CD2)"
                maxLength={8}
                className="px-3 py-2 rounded-xl bg-background border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 uppercase"
              />
              <button
                onClick={handleJoinTeam}
                disabled={actionLoading || joinCode.length < 4}
                className="px-4 py-2.5 rounded-xl font-bold text-sm border border-border bg-muted text-foreground hover:border-primary/40 disabled:opacity-50"
              >
                {actionLoading ? 'Joining...' : 'Join Team'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Team dashboard */}
      {!loading && team && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-foreground">{team.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Join code: <span className="font-mono text-primary">{team.code}</span>
                {' · '}{members.length}/{team.seat_limit} seats used
              </p>
            </div>
            {unreadCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-[rgba(201,150,12,0.08)]">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-mono text-primary">{unreadCount} new</span>
              </div>
            )}
          </div>

          {/* My stats */}
          {myMember && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Your Rank" value={`#${myRank}`} sub={`of ${members.length} reps`} color="#c9960c" />
              <StatCard label="Avg Score" value={myMember.avg_score != null ? `${myMember.avg_score}` : '—'} sub="call performance" color="#00c896" />
              <StatCard label="Total Calls" value={String(myMember.total_calls ?? 0)} />
              <StatCard label="Role" value={myMember.role.charAt(0).toUpperCase() + myMember.role.slice(1)} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            {/* Leaderboard */}
            <div className="rounded-2xl border border-border bg-card p-4" style={{ backdropFilter: 'blur(8px)' }}>
              <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-3">Leaderboard</p>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No members yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {members.map((member, idx) => {
                    const isMe = member.user_id === userId;
                    const rank = idx + 1;
                    const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                    const scoreColor = (member.avg_score ?? 0) >= 75 ? '#00c896' : (member.avg_score ?? 0) >= 50 ? '#c9960c' : '#ff4757';

                    return (
                      <div
                        key={member.user_id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          isMe
                            ? 'border-primary/30 bg-[rgba(201,150,12,0.06)]'
                            : 'border-border bg-background'
                        }`}
                      >
                        <span className="w-10 text-center font-mono text-sm">{rankEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-foreground/90 truncate">
                              {member.display_name}{isMe && <span className="text-muted-foreground font-normal"> (you)</span>}
                            </p>
                            {roleChip(member.role)}
                          </div>
                          <p className="text-[0.62rem] text-muted-foreground mt-0.5">
                            {member.total_calls} call{member.total_calls !== 1 ? 's' : ''}
                            {member.last_call_at && ` · Last: ${new Date(member.last_call_at).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-black text-lg" style={{ color: member.avg_score != null ? scoreColor : '#666' }}>
                            {member.avg_score != null ? member.avg_score : '—'}
                          </p>
                          <p className="text-[0.58rem] text-muted-foreground">avg score</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-col" style={{ backdropFilter: 'blur(8px)' }}>
              <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-3">Inbox</p>
              {notifications.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  <p className="text-xs text-muted-foreground">No notifications yet.</p>
                  <p className="text-[0.6rem] text-muted-foreground">Manager feedback and alerts appear here.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[400px]">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && markNotificationRead(n.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all hover:border-primary/30 ${
                        n.read ? 'border-border bg-background opacity-60' : 'border-primary/20 bg-[rgba(201,150,12,0.04)]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                        <p className="text-xs text-foreground/80 leading-relaxed">{n.message}</p>
                      </div>
                      <p className="text-[0.58rem] text-muted-foreground mt-1.5 ml-3.5">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
          <div className="h-64 rounded-2xl bg-card border border-border animate-pulse" />
        </div>
      )}
    </div>
  );
}
