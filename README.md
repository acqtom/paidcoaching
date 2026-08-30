# Student Portal

A team hub: sign up / log in (with email password reset) then land on a
dashboard of cards linking out to different tools. Built with Next.js (App
Router) and Supabase Auth.

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard go to **Project Settings → API** and copy the
   **Project URL** and **anon public** key.
3. Copy `.env.local.example` to `.env.local` and fill in those values:

   ```bash
   cp .env.local.example .env.local
   ```

4. In **Authentication → URL Configuration**, set the **Site URL** to
   `http://localhost:3000` for local dev (and add your production URL once
   deployed), and add `http://localhost:3000/auth/callback` (and the
   production equivalent) to **Redirect URLs**.
5. Email confirmation and password-reset emails are sent by Supabase's
   built-in email service by default (rate-limited, fine for testing). For
   production, configure a custom SMTP provider under **Project Settings →
   Auth → SMTP Settings** so emails don't land in spam / hit rate limits.
6. In the Supabase dashboard's **SQL Editor**, run the migrations in
   `supabase/migrations/` in order (`0001_profiles.sql`, then
   `0002_seed_tom_username.sql`). This creates the `profiles` table that
   stores each user's username and auto-fills it from what they enter at
   signup.
7. Create a free account at [resend.com](https://resend.com) and grab an
   API key — this sends the "Submit a bug" emails. Set `RESEND_API_KEY` in
   `.env.local`. Without a verified sending domain, Resend only lets the
   default `onboarding@resend.dev` sender deliver to the email address you
   signed up to Resend with; verify a domain there (and set
   `RESEND_FROM_EMAIL`) to send to anyone else.

## Running locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to
`/login`. Create an account, confirm via the email Supabase sends, then log
in and you'll land on `/dashboard`.

## Structure

- `src/app/login`, `/signup`, `/forgot-password`, `/reset-password` — auth
  pages, backed by server actions in `src/lib/auth-actions.ts`.
- `src/proxy.ts` + `src/lib/supabase/middleware.ts` — protects
  everything except the auth pages; redirects logged-in users away from
  login/signup.
- `src/app/dashboard` — the card grid; each card (defined in
  `src/lib/cards.ts`, with its `href`) either opens an external tool in a
  new tab or navigates to an internal page (Start Here, SOPs).
- `src/app/dashboard/sops` — SOP hub, three levels deep (data in
  `src/lib/sops.ts`): a department grid (Operations, Marketing, Sales,
  Fulfilment) → each department's list of SOPs → each SOP's sub-category
  sidebar with a Loom video placeholder and content per lesson.
- `supabase/migrations/` — SQL to run in the Supabase SQL Editor. Sets up a
  `profiles` table (one row per user, holding their public `username`,
  3–20 chars, letters/numbers/underscores) auto-populated from the username
  entered at signup, plus row-level security so usernames are readable by
  everyone but only editable by their owner.
- `src/components/BugReportButton.tsx` + `src/lib/bug-report-actions.ts` —
  the "Submit a bug" button/modal on the dashboard, which emails
  tom@educatr.co via Resend.
- `public/tracking-app/index.html` + `src/app/dashboard/tracking` — the
  Metrics Tracking dashboard, ported from the `acqtom/tracking` repo. It's a
  fully self-contained client-side app (state lives in each viewer's own
  `localStorage`, no backend), served as a static file and embedded via
  iframe at `/dashboard/tracking` so it renders in complete CSS/JS isolation
  from the rest of the app. The original's password gate was removed (this
  route is already behind real login), and a pre-existing bug was fixed
  where typing a second digit into a metric cell would scramble the value
  (the table rebuilds on every keystroke and refocuses the new input
  without restoring cursor position — fixed by switching those inputs from
  `type="number"`, which can't have its selection set via JS, to `text`).
  The repo's OAuth integration backend (Typeform/Calendly/Meta/Whop) was
  *not* ported — it exists in that repo but was never actually wired into
  its frontend, so nothing there was actually live to duplicate.

## Deploying

Any Next.js host works (e.g. Vercel). Set the same environment variables
there, and update `NEXT_PUBLIC_SITE_URL` plus the Supabase redirect URLs to
match the production domain.
