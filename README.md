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
   `supabase/migrations/` in order. `0001_profiles.sql` + `0002_...` set up
   the `profiles` table (username, auto-filled at signup).
   `0003_daily_kill_list_state.sql` sets up the shared state table behind
   the Daily Kill List's day-scoped sync (calls, braindump).
   `0004_task_backlog_state.sql` sets up the table behind its persistent
   backlog + Yearly Goals. `0005_content_hub_state.sql` sets up the
   per-user table behind the Weekly Content Hub.
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
- `src/app/dashboard/accounting` — the Accounting Hub, ported natively (real
  React components, not an iframe) from the `acqtom/accounting` repo. Fully
  self-contained client-side (state in `localStorage`); loaded via
  `next/dynamic({ ssr: false })` since that state doesn't exist during
  server rendering. The original's passcode gate was dropped for the same
  reason as tracking's.

  The PnL statement was simplified from the original's per-client
  revenue/equity/bonus model down to: one Revenue number; expenses as
  Editor (manual), Ad Spend (manual), Setter (fixed 5% of revenue), and
  Closer (fixed 10% of revenue), plus any number of free-form name/amount
  expenses; Net Profit = Revenue − Total Expenses. NZD was dropped
  entirely (USD only). `lib/storage.ts` migrates months saved under the
  old per-client shape into the new one on load.

  Capital Allocation is no longer fixed dollar caps — it's a
  fully-editable list of categories (`AppData.capitalCategories`, global
  across months, not per-month), each with a name and a % of that month's
  net profit; add, rename, re-percentage, or remove categories freely, with
  a live "N% allocated" indicator. The invoicing feature (button, modal,
  PDF export via `jspdf`/`html2canvas-pro`, Recent Invoices) was removed
  entirely along with those two now-unused dependencies.

  Re-verified end-to-end after each change (Puppeteer, values checked by
  hand): revenue → expenses (including Ad Spend) → net profit → editing,
  adding, and removing capital allocation categories, with dollar amounts
  and the allocated-% indicator all matching the formulas exactly.
- `public/daily-kill-list-app/` + `src/app/dashboard/daily-kill-list` — the
  Daily Kill List. Originally two separate ports (Daily Kill List, from
  `acqtom/todo` "Focus Engine", and the standalone Prioritization Task
  Backlog, from `acqtom/backlog`) that were later merged into one card at
  the user's request. Static HTML/CSS/JS, embedded via iframe as usual.

  Two independent state slices, each keeping its source app's original
  sync architecture:
  - **Day-scoped** (changes with the date-nav up top): Daily Calls (with
    repeat schedules) and a per-day Braindump. Cross-device sync via
    `/api/daily-kill-list/state` → a `daily_kill_list_state` table (one
    shared JSON blob, RLS-gated to any authenticated portal user), cached
    in each browser's `localStorage` for instant offline access with a
    debounced background push — unchanged from the original Daily Kill
    List. The original's needle-mover tasks, per-client to-do cards, and
    revenue/streak tracking were dropped (superseded by the backlog below,
    or just removed) at the user's request; their old data isn't deleted
    from the stored JSON on save, just no longer read or rendered, so nothing
    already entered there is destroyed by the merge.
  - **Persistent** (ignores the date-nav — one shared, ongoing list): the
    backlog and Yearly Goals, via `/api/daily-kill-list/backlog` → the
    `task_backlog_state` table from the original standalone Task Backlog
    port (reused as-is; it's just a jsonb column, so no migration was
    needed for the new shape). Same GET-latest → mutate → POST round-trip
    per change, no local cache, as the original Task Backlog. Its client
    (Adriel/Alex) and per-assignee (Tom/Derek) routing was replaced with
    four fixed departments — Marketing, Sales, Operations, Fulfilment —
    each getting its own to-do card alongside the main filterable Backlog
    list; the per-task assignee dropdown is gone, but level (High/Medium/
    Low), the top-priority ⭐, and repeat-on-add are unchanged. Any task
    saved under the old client/assignee schema before the merge shipped
    still loads (nothing is deleted), defaulting to Marketing until
    manually re-filed.

  Verified via Puppeteer with both endpoints mocked (a real authenticated
  session isn't available in a headless run, so `fetch` was intercepted
  with in-memory stores matching each real route's exact contract): added
  a call and confirmed its Meet link and one-off (non-repeating) day
  scoping, confirmed the braindump is keyed per day when navigating
  dates, added tasks to each of the four departments and confirmed they
  routed to the right card, confirmed the top-priority star re-sorts
  above non-priority tasks, checked off a task and confirmed it moved to
  Completed with the progress bar/counts updating correctly, and added a
  yearly goal — all matched expectations with zero console errors. Both
  Supabase-backed tables need their migrations run (see Setup) for real
  cross-device persistence.
- `src/app/dashboard/weekly-content-hub` — the Weekly Content Hub, built
  natively (not a port) as real React/Tailwind components, since there was
  no existing app to preserve behavior from. Three tabs: a Kanban board
  (Idea → Scripting → Filming → Editing → Published columns, native HTML5
  drag-and-drop between them, no library), Content (a left sidebar of
  documents — seeded on first visit with the existing YouTube/Instagram/Ads
  planning template — each opening a plain title + free-text body editor
  on the right), and Team (`TeamTab.tsx`) — a small name + stage table; each
  saved member shows as a "Responsible: <name>" label under that stage's
  Kanban column header (one general owner per column, not a per-card
  assignee — multiple members on the same stage are comma-joined).

  Unlike every other feature in this app, this one is **private per
  account** rather than shared team-wide, per the user's explicit call (a
  future "custom team login" to let a user share their own board with
  their team is planned separately, not built yet). Backed by
  `content_hub_state` (`supabase/migrations/0005_...sql`) — one JSON blob
  per user, RLS-gated to `auth.uid() = id` instead of the shared-singleton
  pattern everywhere else — behind `/api/content-hub/state`
  (`src/app/api/content-hub/state/route.ts`). Local React state with a
  debounced save + background poll, same shape as Daily Kill List's
  day-scoped side, just per-user instead of localStorage-cached.

  Verified via Puppeteer: since this route sits behind real server-side
  auth (not just a public static asset), it was temporarily added to the
  middleware's public paths for this one local test run only, with `fetch`
  mocked against an in-memory store matching the real route's contract,
  then fully reverted (confirmed via `git diff`) before anything was
  committed. Added cards to multiple Kanban columns, dragged one between
  columns via simulated native `DragEvent`s and confirmed the column
  counts updated correctly, confirmed all 19 default documents seed
  correctly in order, edited a document's title/body, added a new
  document, and — after the Team tab was added — added two team members
  to different stages and confirmed each showed up as the right
  "Responsible: <name>" label under the matching Kanban column, and that
  removing a member updated the table correctly — all matched
  expectations with zero console errors.

## Deploying

Any Next.js host works (e.g. Vercel). Set the same environment variables
there, and update `NEXT_PUBLIC_SITE_URL` plus the Supabase redirect URLs to
match the production domain.
