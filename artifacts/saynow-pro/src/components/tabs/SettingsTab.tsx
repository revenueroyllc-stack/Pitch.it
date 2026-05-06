import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/AppToast';
import { useSubscription } from '@/hooks/use-subscription';

interface Credits {
  monthly_briefs_used: number;
  monthly_intervals_used: number;
  monthly_debriefs_used: number;
  pack_briefs: number;
  pack_intervals: number;
  pack_debriefs: number;
  reset_date?: string;
}

interface SettingsTabProps {
  userId?: string;
  userEmail?: string;
  onSignOut: () => void;
  onOpenCreditModal: () => void;
}

const MONTHLY_LIMITS = { brief: 10, interval: 300, debrief: 10 };

function CreditBar({ used, pack, limit, label }: { used: number; pack: number; limit: number; label: string }) {
  const pct = Math.min(100, (used / limit) * 100);
  const remaining = Math.max(0, limit - used);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-mono font-bold" style={{ color: remaining === 0 ? '#ff4757' : '#f5f5f5' }}>
          {remaining} left
          {pack > 0 && <span className="ml-1.5 text-[0.65rem] font-normal text-primary">+{pack} pack</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 90 ? '#ff4757' : pct >= 70 ? '#c9960c' : '#00c896',
          }}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5" style={{ backdropFilter: 'blur(8px)' }}>
      <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-4">{title}</p>
      {children}
    </div>
  );
}

export function SettingsTab({ userId, userEmail, onSignOut, onOpenCreditModal }: SettingsTabProps) {
  const subStatus = useSubscription(userId, userEmail);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [notifs, setNotifs] = useState({ lowCredits: true, teamEvents: true, personalBest: true });
  const fileRef = useRef<HTMLInputElement>(null);

  // Load profile
  useEffect(() => {
    if (!supabase || !userId) return;
    supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle().then(({ data }) => {
      if (data) {
        setDisplayName(data.display_name || '');
        setAvatarUrl(data.avatar_url || '');
        setCallerPhone(data.caller_phone || '');
        if (data.notification_prefs) setNotifs(data.notification_prefs);
      }
    });
  }, [userId]);

  // Load credits
  useEffect(() => {
    if (!userId) { setCreditsLoading(false); return; }
    fetch(`/api/credits?userId=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setCredits(data); })
      .catch(() => {})
      .finally(() => setCreditsLoading(false));
  }, [userId]);

  async function handleSaveProfile() {
    if (!supabase || !userId) return;
    setSavingProfile(true);
    try {
      await supabase.from('user_profiles').upsert({
        user_id: userId,
        display_name: displayName,
        avatar_url: avatarUrl,
        caller_phone: callerPhone,
        notification_prefs: notifs,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      toast.success('Profile saved');
    } catch {
      toast.error('Failed to save profile');
    }
    setSavingProfile(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !supabase || !userId) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${userId}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) {
        if (error.message.toLowerCase().includes('bucket') || error.statusCode === '404' || (error as { status?: number }).status === 404) {
          await fetch(`${import.meta.env.BASE_URL}api/storage/init-avatars`, { method: 'POST' });
          const { error: retryError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(urlData.publicUrl);
      toast.success('Photo uploaded');
    } catch {
      toast.error('Photo upload failed — check that Supabase Storage is enabled in your project');
    }
    setUploadingAvatar(false);
  }

  const planLabel = subStatus === 'active' ? 'Pro' : subStatus === 'admin' ? 'Admin' : 'Free';
  const planColor = subStatus === 'active' || subStatus === 'admin' ? '#c9960c' : '#888';

  const resetDate = credits?.reset_date
    ? new Date(credits.reset_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="relative z-10 flex flex-col gap-4 p-5 pb-24 overflow-auto flex-1" data-testid="settings-tab">

      {/* Profile */}
      <Section title="Profile">
        <div className="flex items-start gap-4 mb-5">
          {/* Avatar */}
          <button
            className="relative w-16 h-16 rounded-2xl border-2 border-border overflow-hidden shrink-0 hover:border-primary/50 transition-all group"
            onClick={() => fileRef.current?.click()}
            title="Upload photo"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-xl font-bold text-primary">
                {displayName ? displayName[0].toUpperCase() : userEmail?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              }
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

          <div className="flex-1 flex flex-col gap-2.5">
            <div>
              <label className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
            <div>
              <label className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Email</label>
              <input
                type="text"
                value={userEmail || ''}
                readOnly
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="w-full py-2.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-px disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #c9960c, #f5d97e)', color: '#1a0a0a' }}
        >
          {savingProfile ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-[#1a0a0a]/40 border-t-[#1a0a0a] rounded-full animate-spin" />
              Saving...
            </span>
          ) : 'Save Profile'}
        </button>
      </Section>

      {/* Subscription & Credits */}
      <Section title="Subscription & Credits">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider border"
                style={{ color: planColor, borderColor: `${planColor}50`, background: `${planColor}12` }}
              >
                {planLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Monthly reset: {resetDate}</p>
          </div>
          <button
            onClick={onOpenCreditModal}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-primary/30 bg-[rgba(201,150,12,0.08)] text-primary hover:bg-[rgba(201,150,12,0.15)] transition-all"
          >
            Buy Credits
          </button>
        </div>

        {creditsLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : credits ? (
          <div className="flex flex-col gap-4">
            <CreditBar
              label="Live Coaching Intervals"
              used={credits.monthly_intervals_used}
              pack={credits.pack_intervals}
              limit={MONTHLY_LIMITS.interval}
            />
            <CreditBar
              label="Battle Briefs"
              used={credits.monthly_briefs_used}
              pack={credits.pack_briefs}
              limit={MONTHLY_LIMITS.brief}
            />
            <CreditBar
              label="AI Debriefs"
              used={credits.monthly_debriefs_used}
              pack={credits.pack_debriefs}
              limit={MONTHLY_LIMITS.debrief}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            {userId ? 'Run your first session to see credit usage.' : 'Sign in to see credit usage.'}
          </p>
        )}
      </Section>

      {/* Verified Caller ID */}
      <Section title="Verified Caller ID">
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Set your verified outbound phone number for Twilio calls. Must be verified in your Twilio console.
        </p>
        <input
          type="tel"
          value={callerPhone}
          onChange={(e) => setCallerPhone(e.target.value)}
          placeholder="+1 555 000 0000"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors mb-3"
        />
        <button
          onClick={handleSaveProfile}
          className="px-4 py-2 rounded-xl text-xs font-bold border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
        >
          Save Caller ID
        </button>
      </Section>

      {/* Notification Preferences */}
      <Section title="Notification Preferences">
        <div className="flex flex-col gap-3">
          {[
            { key: 'lowCredits',   label: 'Low credit warnings',      desc: 'Alert when monthly credits are nearly used' },
            { key: 'teamEvents',   label: 'Team activity',             desc: 'New members, leaderboard changes' },
            { key: 'personalBest', label: 'Personal best alerts',      desc: 'When you beat your top call score' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-1">
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => setNotifs((prev) => ({ ...prev, [key]: !prev[key as keyof typeof notifs] }))}
                className="relative w-10 h-5.5 rounded-full transition-all shrink-0"
                style={{
                  background: notifs[key as keyof typeof notifs] ? '#c9960c' : 'rgba(255,255,255,0.1)',
                  height: 22,
                  width: 40,
                  border: `1px solid ${notifs[key as keyof typeof notifs] ? 'rgba(201,150,12,0.5)' : 'rgba(255,255,255,0.15)'}`,
                }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: notifs[key as keyof typeof notifs] ? 20 : 2 }}
                />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleSaveProfile}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-bold border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
        >
          Save Preferences
        </button>
      </Section>

      {/* Account */}
      <Section title="Account">
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-xl border border-border bg-background">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{userEmail || 'Demo mode'}</p>
          </div>
          <button
            onClick={onSignOut}
            className="w-full py-2.5 rounded-xl text-sm font-bold border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-all"
          >
            Sign Out
          </button>
        </div>
      </Section>
    </div>
  );
}
