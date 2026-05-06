# SayNow Pro

A premium real-time sales intelligence platform — an AI coaching cockpit for sales calls.

## Architecture

**Monorepo** (pnpm workspace) with:
- `artifacts/saynow-pro` — React + Vite frontend (port 26131, preview path `/`, served as static in production)
- `artifacts/saynow-pro-mobile` — Expo (React Native) mobile app (preview path `/mobile/`, port 20085)
  - **Dev serving**: `server/serve.js` starts immediately (health check passes), triggers `expo export --platform web` in background
  - **Layout split**: `app/(tabs)/_layout.tsx` = web-only (Feather icons); `_layout.native.tsx` = iOS/Android (NativeTabs, SymbolView)
  - **artifact.toml**: `router` omitted (uses standard path proxy); `ensurePreviewReachable = "/status"`
- `artifacts/api-server` — Express API server (port 8080, path `/api`) — **serves all API calls for SayNow Pro**
- `artifacts/mockup-sandbox` — Canvas component sandbox

## API Routing (Critical)

`saynow-pro` is a **pure static Vite app**. ALL `/api/*` requests route to `artifacts/api-server` via the shared proxy. The `api/` folder in `saynow-pro/` contains legacy reference files only — all active API logic lives in:

- `artifacts/api-server/src/routes/saynow.ts` — Claude, Deepgram token, Twilio token, Stripe checkout, credits

The `stripeWebhookHandler` is registered in `app.ts` with `express.raw()` BEFORE `express.json()` so it receives the raw body Stripe requires.

## SayNow Pro Stack

- **Frontend**: React + TypeScript + Vite, Tailwind CSS v4, dark amber/gold theme
- **Navigation**: Persistent bottom nav with icons (7 tabs: Prep, Live, Vault, Debrief, Profile, Team, Settings)
- **Transcription**: Deepgram API (WebSocket streaming, diarized, sentiment) → fallback to Browser Web Speech API
- **Dialer**: Twilio Voice SDK (outbound calls with live recording)
- **AI Coaching**: Anthropic Claude `claude-sonnet-4-5` with global system prompt (concise, 1-sentence cards)
- **Auth + Data**: Supabase (optional — app runs in Demo Mode without it)
- **Payments**: Stripe (subscriptions + credit packs)

## Environment Variables

### Required for full functionality

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side credit checks) |
| `ANTHROPIC_API_KEY` | Claude AI for coaching, briefs, debriefs |
| `STRIPE_SECRET_KEY` | Stripe secret key (checkout + webhooks) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (frontend Stripe.js) |

### Optional — graceful degradation if missing

| Variable | Description | Fallback |
|---|---|---|
| `DEEPGRAM_API_KEY` | Real-time audio transcription with diarization + sentiment | Browser Web Speech API |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | Dialer panel shows "not configured" |
| `TWILIO_API_KEY` | Twilio API key (NOT auth token) | Dialer disabled |
| `TWILIO_API_SECRET` | Twilio API key secret | Dialer disabled |
| `TWILIO_TWIML_APP_SID` | TwiML App SID for outbound calls | Dialer disabled |

> **Twilio setup**: Create an API Key in Twilio Console (not the Account Auth Token). The TwiML App must have a Voice URL pointing to your server.

## Supabase Schema

Run these migrations in the Supabase SQL editor in order:

### Migration 001 — Core tables (required)
```sql
create table call_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  objective text,
  talking_points jsonb,
  objections jsonb,
  prospect_info jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table call_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  workspace_id uuid,
  objective text,
  transcript jsonb,
  coach_cards jsonb,
  duration_seconds int,
  score int,
  sentiment int,
  talk_ratio int,
  outcome text check (outcome in ('closed','follow_up','no_interest','voicemail') or outcome is null),
  created_at timestamptz default now()
);

create table credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  monthly_briefs_used int not null default 0,
  monthly_intervals_used int not null default 0,
  monthly_debriefs_used int not null default 0,
  pack_briefs int not null default 0,
  pack_intervals int not null default 0,
  pack_debriefs int not null default 0,
  reset_date date not null default current_date,
  updated_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  email text,
  stripe_customer_id text,
  stripe_session_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Migrations 002–006 — Team + Profile features

Run files `002_user_profiles.sql` through `006_notifications.sql` from the `supabase/migrations/` directory.

### Migration 007 — Settings columns (optional, adds caller_phone and notification_prefs)
```sql
alter table user_profiles
  add column if not exists caller_phone text,
  add column if not exists notification_prefs jsonb default '{"lowCredits":true,"teamEvents":true,"personalBest":true}'::jsonb;
```

## Credit System

### Monthly Free Tier (per billing period)
- 10 battle briefs
- 300 live-coach intervals (8 seconds each)
- 10 AI debriefs

### Credit Packs (one-time purchase via Stripe)
| Pack | Price ID | Briefs | Intervals | Debriefs |
|---|---|---|---|---|
| Small | price_1TTT5IQkADh5vQgnZtRjqwt3 | 5 | 100 | 5 |
| Medium | price_1TTT6NQkADh5vQgnj6bFuBGo | 15 | 300 | 15 |
| Large | price_1TTT80QkADh5vQgnHJHrBp5K | 40 | 800 | 40 |

### Event-Coach (Always Free)
Real-time urgency triggers fire without consuming credits. The **Decision Engine** (`lib/decisionEngine.ts`) routes each signal:
- **ESCALATE_AI** → objection, competitor, very low prospect sentiment, close opportunity → calls Claude
- **WARNING/TIP** (instant, no Claude) → silence, talk-ratio warning, filler-spike, no-question → heuristic card only
- **NONE** → no action needed
This means most signals get instant feedback in milliseconds. Claude is only called when strategic intelligence is genuinely needed.

## Features

1. **Prep Tab** — Prospect intel, battle brief generator, talking points manager, objection prep
2. **Live Coach Tab** — Deepgram real-time transcription (diarized), dual sentiment gauges (you/prospect), live score meter, talk ratio split bar, 8-second AI coaching intervals (60s rolling context), Live Intelligence Status panel, manual event trigger buttons (Objection/Silence/No Q/Too Much/Fillers), decision engine routing, priority voice coaching (rate+pitch+volume per urgency), Twilio dialer panel
3. **Vault Tab** — Searchable objection card grid + competitor battlecards
4. **Debrief Tab** — Post-call score (A/B/C/D grades), call outcome tracking (Closed/Follow-up/No Interest/Voicemail), strengths/misses analysis, AI follow-up email, session history replay
5. **Profile Tab** — All-time stats, score trend bar chart, performance badges
6. **Team Tab** — Create/join teams, leaderboard by avg call score, notification inbox, manager roles
7. **Settings Tab** — Editable profile (name, avatar photo upload to Supabase Storage), subscription status card, credit usage bars, verified caller ID, notification preferences, sign out

## Navigation

Persistent **bottom nav bar** with icon + label for all 7 tabs. Active tab shows amber indicator bar + brighter icon + colored label. Inactive tabs are dimmed. Badge (amber pill) shown on Live and Vault tabs when there's activity.

## Key Files

- `artifacts/saynow-pro/src/App.tsx` — Main app, all state, Deepgram hook integration, event triggers, bottom nav layout
- `artifacts/saynow-pro/src/components/layout/NavTabs.tsx` — Bottom persistent nav with SVG icons
- `artifacts/saynow-pro/src/components/tabs/SettingsTab.tsx` — Profile edit, subscription status, credits, notifications
- `artifacts/saynow-pro/src/components/ui/AppToast.tsx` — Micro-animation toast notification system
- `artifacts/saynow-pro/src/lib/useDeepgram.ts` — Deepgram WebSocket hook with objection/competitor/silence/filler-spike detection
- `artifacts/saynow-pro/src/lib/decisionEngine.ts` — Signal→Decision brain: routes events to instant coaching or Claude escalation
- `artifacts/saynow-pro/src/lib/coach.ts` — Coach logic: heuristics, sentiment, scoring, deduplication
- `artifacts/saynow-pro/src/components/coach/IntelligenceStatus.tsx` — Live situational awareness panel (critical/warning/positive/neutral)
- `artifacts/api-server/src/routes/saynow.ts` — ALL SayNow Pro API routes (claude, deepgram-token, twilio-token, create-checkout-session, credits, stripe-webhook)
- `artifacts/api-server/src/app.ts` — Express app with stripe webhook raw body before json middleware
- `artifacts/saynow-pro/supabase/migrations/` — SQL migration files 001–006

## Design

- **Palette**: Near-black `#080808` bg, amber/gold primary `#c9960c`/`#f5d97e`, green `#00c896`, red `#ff4757`, blue `#4a90d9`
- **Fonts**: Epilogue (display) + JetBrains Mono (data/timestamps)
- **Effects**: Amber radial glow, gold grid overlay via body pseudo-elements, backdrop-filter blur on all panels
- **Animations**: Tab content fade+slide-in (`animate-tab-in`), card pop-in (`animate-card-pop`), toast slide-in from right, score circle, talk-ratio bar transition, waveform bars

## Gotchas

- **NavTabs sizing**: Each tab button uses `flex-1 min-w-0 flexShrink:1` (NO minWidth, NO flexShrink:0) so all 7 tabs always share space equally without overflowing. Do NOT add `minWidth` or `flexShrink:0` or tabs 6+7 (Team/Settings) will be hidden on mobile.
- **DebriefTab sessionId**: `handleSaveSession` in App.tsx captures the returned row ID via `.select().single()` and stores it in `lastSavedSessionId` state, which is passed as `sessionId` prop to DebriefTab. This is how the outcome selector saves to the right DB row after a live call.
- **Claude API status**: The frontend always shows "Claude AI active" in PrepTab — there is no runtime key check from the browser. If ANTHROPIC_API_KEY is missing from the server env, `/api/claude` returns 500 silently and coaching cards just don't appear.
- **Mobile workflow**: `serve.js` binds port 20085 immediately (no blocking startup). If it fails with "didn't open port", check that `PORT=20085` env var is set (defined in artifact.toml `[services.env]`) and re-run `restart_workflow`.
