# SayNow Pro

A production-oriented React + Vite sales-call coaching workspace with:

- Supabase email/password authentication
- Saved workspaces for objectives, talking points, and objection handling
- Live browser speech-recognition transcript capture
- AI coach webhook integration with heuristic fallback
- Session snapshot history and replay UI
- Deployment configs for GitHub Pages, Netlify, and Vercel

## Project structure

```text
saynow-pro-vite/
├─ public/
│  └─ saynow-logo.png
├─ src/
│  ├─ lib/
│  │  └─ coach.js
│  ├─ App.jsx
│  ├─ index.css
│  └─ main.jsx
├─ supabase/
│  └─ functions/
│     ├─ _shared/
│     │  └─ cors.ts
│     └─ live-coach/
│        └─ index.ts
├─ .github/workflows/deploy-pages.yml
├─ .env.example
├─ netlify.toml
├─ vercel.json
├─ vite.config.js
└─ supabase_schema.sql
```

## Local development

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Fill in your values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_COACH_WEBHOOK_URL=https://YOUR_EDGE_FUNCTION_OR_API_ENDPOINT
VITE_COACH_WEBHOOK_BEARER=OPTIONAL_BEARER_TOKEN
```

4. Start development server:

```bash
npm run dev
```

5. Create a production build:

```bash
npm run build
```

## Supabase setup

### 1) Run the SQL schema

Open the Supabase SQL editor and run the contents of `supabase_schema.sql`.

This creates:

- `call_workspaces`
- `call_sessions`
- row level security policies so users only access their own records

### 2) Enable email/password auth

In Supabase Auth:

- enable Email provider
- optionally disable email confirmation for faster local testing

### 3) Add frontend environment values

Use your Supabase project URL and anon key in `.env` locally and in deployment secrets/variables remotely.

## Live coaching webhook

The frontend sends the latest transcript context to `VITE_COACH_WEBHOOK_URL` and expects JSON like this:

```json
{
  "cards": [
    {
      "type": "Tip",
      "tone": "tip",
      "trigger": "pricing concern detected",
      "text": "Anchor on ROI before discussing price.",
      "quote": "What would make the investment worthwhile for your team?",
      "timestamp": "01:14"
    }
  ]
}
```

The included example Edge Function in `supabase/functions/live-coach/index.ts` is deployable as-is and returns working coaching cards using heuristics.

### Deploy the included Edge Function

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy live-coach
```

Then set:

```env
VITE_COACH_WEBHOOK_URL=https://YOUR_PROJECT_REF.functions.supabase.co/live-coach
```

If you set a bearer token in the frontend, set the same `COACH_WEBHOOK_BEARER` secret for the function.

## GitHub Pages deployment

The repo includes `.github/workflows/deploy-pages.yml`.

### Required GitHub repository secrets or variables

Set these in your repo settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_COACH_WEBHOOK_URL` (optional)
- `VITE_COACH_WEBHOOK_BEARER` (optional)

### Pages setup

- push to `main`
- enable GitHub Pages in the repository settings if needed
- the workflow will build and publish `dist/`

## Netlify deployment

This repo includes `netlify.toml`.

- import the repo into Netlify
- set the same environment variables
- Netlify will use `npm run build` and publish `dist`

## Vercel deployment

This repo includes `vercel.json`.

- import the repo into Vercel
- set the same environment variables
- Vercel will build the Vite app and serve the SPA correctly

## Browser support notes

Live transcript capture uses the browser speech recognition API.

Best support:

- Google Chrome
- Microsoft Edge

Fallback behavior:

- if speech recognition is unavailable, the app still works for prep, objections, auth, saved sessions, and manual coaching cards
- if the AI webhook is unavailable, the app falls back to heuristic coach suggestions

## Session history and replay

Saved session snapshots appear in the Debrief tab.

Each snapshot stores:

- objective
- transcript entries
- coach cards
- duration in seconds
- creation time

Replay loads that snapshot back into the Live Coach tab for review.

## Notes about the logo

The remixed SayNow asset is integrated into the app header as a branded image at `public/saynow-logo.png`. Replace that file any time you want to swap in a newer logo version.
