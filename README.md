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
   `0003_daily_kill_list_state.sql` sets up the state table behind
   the Daily Kill List's day-scoped sync (calls, braindump), originally
   shared team-wide but made private per account by `0018_...sql` below.
   `0004_task_backlog_state.sql` sets up the table behind its persistent
   backlog + Yearly Goals, same original-shared/later-private-per-account
   arc. `0005_content_hub_state.sql` sets up the
   per-user table behind the Weekly Content Hub, plus the two
   `SECURITY DEFINER` functions its `/team-access` secret-key flow calls.
   `0006_sales_board_state.sql` sets up the per-user table behind the
   Sales Team Board. `0007_sales_board_access_code.sql` adds its own
   separate secret-key sharing flow (its own column + functions, distinct
   from Content Hub's), the same shape as 0005's but for the sales board.
   `0008_metrics_tracking_state.sql` sets up the per-user table behind
   Metrics Tracking, plus the `get_sales_board_owner_id` function the
   Sales Team Board's secret-key save path needs to push into it.
   `0009_communications.sql` sets up the Communications Hub's `conversations`
   + `messages` tables, RLS, a trigger that gives every regular user a DM
   conversation the moment their profile exists, enables Realtime on
   `messages`, and creates the `chat-uploads` Storage bucket for photos.
   Unlike every earlier migration, this one needs Realtime turned on for
   the `messages` table to actually deliver live updates — the migration's
   `alter publication` line handles this via SQL directly, but it's worth
   confirming under **Database → Publications** in the dashboard (not
   **Replication**, which in current Supabase is an unrelated feature for
   streaming to external destinations like BigQuery — the `messages` table
   should show up under the `supabase_realtime` publication's table count).
   `0010_message_delete.sql` adds soft-delete (`deleted_at`/`deleted_by`
   columns, an UPDATE policy letting a sender delete their own message or
   an admin delete any message, and a trigger that rejects any UPDATE that
   isn't just those two columns changing, so this can never become a way
   to edit message content). `0011_conversation_reads.sql` adds
   per-conversation read tracking (`conversation_reads`) and
   `has_unread_communications()`, which is what turns the dashboard's
   Communications card green. `0012_welcome_bot.sql` makes `sender_id`
   nullable (null = a bot/system post, not a real account), adds a
   uniqueness constraint on channel names, and adds a trigger that
   find-or-creates `#general` and posts a welcome message there every
   time someone new joins — it also re-defines
   `has_unread_communications()` to fix a real bug this introduces (see
   below). `0013_channel_lock.sql` adds an `admin_only_posting` toggle
   per channel, the first UPDATE policy on `conversations` (only admins,
   only channels), and replaces the messages INSERT policy so a locked
   channel rejects a post from anyone but an admin.
   `0014_reactions_and_edit.sql` adds `message_reactions` (RLS + Realtime)
   and message editing — `messages.edited_at`, and a rewritten update
   trigger that now allows `body` to change, but only by the original
   sender and never on a deleted message (replacing 0010's trigger, which
   flatly forbade any content change at all).
   `0015_profiles.sql` adds `avatar_path`/`bio`/`instagram_url`/
   `youtube_url` to `profiles` and creates the `avatars` Storage bucket
   (public, one folder per user id, RLS'd the same way as
   `chat-uploads`). It also lets users edit their own username for the
   first time — closing the self-promotion hole that opens up as a
   result: `profiles`' existing "Users can update their own profile"
   policy only ever checked ownership, never length, so without a guard
   anyone could rename themselves to a single character and grant
   themselves admin (`is_admin()` is purely "username is one
   character"). A new `profiles_username_length` trigger blocks any
   *app-originated* username change under 3 characters (it checks
   `auth.uid() is not null`, which is only true for a request going
   through RLS — a direct SQL Editor connection is unaffected, so
   provisioning a new admin still works exactly like the `t` seed in
   `0002_..._seed_tom.sql`).
   `0016_sops.sql` creates `sops`/`sop_subcategories`/`sop_lessons`
   (view open to any authenticated user, write gated to admins via
   `is_admin()`) and seeds them with the SOPs that used to be hardcoded
   in `src/lib/sops.ts`, so existing `/dashboard/sops/...` links keep
   working after this ships.
   `0017_sop_lesson_content_resources.sql` renames
   `sop_lessons.notes` to `content` (a lesson's big paste-anything text
   block instead of a short note) and adds `sop_lesson_resources`
   (per-lesson named links, same admin-write/everyone-read RLS split).
   **`0018_private_daily_kill_list.sql` drops and recreates
   `daily_kill_list_state` and `task_backlog_state`** as per-account
   tables (`id uuid references auth.users(id)`, RLS `auth.uid() = id`),
   reversing their original "one shared team-wide board" design at the
   user's explicit direction. This one really is destructive — everyone's
   existing Daily Kill List, backlog, and Yearly Goals content is
   discarded (the user's own call: there's no way to tell which of the
   old shared tasks belonged to whom, so every account starts fresh
   rather than everyone getting a duplicate copy of the old shared
   list). Back up that data first if it still matters before running
   this one.
   `0019_delete_channels.sql` adds a DELETE policy on `conversations`
   letting admins delete a channel — gated `type = 'channel'` the same
   way the admin-only UPDATE policy from `0013_channel_lock.sql` is, so
   DMs can never be deleted. Messages, reactions, and read-tracking rows
   all already cascade-delete off `conversations.id`, so no extra
   cleanup is needed.
   `0020_student_data.sql` adds `profiles.full_name` (updating
   `handle_new_user()` to copy it out of signup metadata alongside
   `username`), a new `intake_form_submissions` table (student-owned
   read/write, admin read-all) for the two Typeform-style forms on Start
   Here, and an `admin_list_students()` function backing the new
   Student Data admin page.
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
  pages, backed by server actions in `src/lib/auth-actions.ts`. Signup
  collects a required **Full name** alongside username/email/password
  (`0020_student_data.sql` adds `profiles.full_name`; `handle_new_user()`
  copies it out of signup metadata the same way it already did for
  `username`) — needed for the Student Data admin page below, and also
  editable afterward via the profile modal (`src/components/
  ProfileModal.tsx`), shown to other viewers above their `@username`
  when set.
- `src/proxy.ts` + `src/lib/supabase/middleware.ts` — protects
  everything except the auth pages; redirects logged-in users away from
  login/signup.
- `src/app/dashboard` — the card grid; each card (defined in
  `src/lib/cards.ts`, with its `href`) either opens an external tool in a
  new tab or navigates to an internal page (Start Here, SOPs). Above the
  grid, two live-data cards (`src/components/CashTargetCard.tsx` +
  `UrgentTasksCard.tsx`) pull straight from two other features rather
  than just linking to them:

  `CashTargetCard` sums this user's own Sales Board deals
  (`sales_board_state`) closed today (`callOutcome ===
  "Closed/Won/Deposit"`, `closingDate === today`) against an editable
  daily target — saved as `dailyCashTarget` inside that same
  `sales_board_state` row (via the existing `/api/sales-board/save`,
  which already merges whichever fields are present) rather than a new
  table, since it's a Sales Board concept through and through and that
  row is already private per user. Progress-bar color follows the same
  good/warn/bad thresholds (≥100% / ≥75% / below) as Metrics Tracking's
  own target system. `UrgentTasksCard` reads this user's own
  `task_backlog_state` row and shows starred (`priority: true`)
  tasks not yet done — `isTaskDoneToday()` in `page.tsx` mirrors
  `isTaskDone()` in `public/daily-kill-list-app/app.js` exactly (a
  repeating task counts as done only if `lastCompletedDate` is today; a
  one-off task just uses its own `done` flag) so a repeating urgent task
  correctly reappears here each day it's due, not just once ever. Both
  cards read their data as a plain server-rendered snapshot on page
  load — no polling, matching how every other dashboard card is already
  just a static tile.

  Verified via a standalone unit test against both pieces of pure logic
  (today-cash summing excludes other outcomes/dates; the done-today check
  for repeating vs. one-off tasks; the combined urgent-task filter) since
  the dashboard route itself needs a real logged-in session to render
  and can't be fetch-mocked like the iframe apps (its data loads
  server-side, not via client `fetch`) — and visually via a static
  mockup using the exact same Tailwind classes as the live components,
  to confirm the two-card row sits correctly above the existing grid at
  every breakpoint.
- `src/app/dashboard/start-here` — the Start Here card's own page: a
  CMO/CEO role picker, then a welcome video, a Calendly slot, and a
  role-specific block underneath (a new-student intake form for CMO, a
  table of what every dashboard card does and where it goes for CEO).
  Pre-dated most of this session's work and had stayed pure scaffolding
  the whole time — a plain pill-style tab switcher, flat gray-gradient
  "coming soon" boxes for the video and Calendly slots, and a bare
  unwrapped form sitting directly on the page background, all visually
  disconnected from the rest of the app. Restyled to match: the CMO/CEO
  switcher (`StartHereTabs.tsx`) became two selectable role-cards using
  the exact same visual language as `DashboardCard.tsx`'s own gold
  variant — inactive cards are plain white/`neutral-900` with an indigo
  icon badge, the active one gets the amber gradient border/background/
  icon-badge treatment `accent: "gold"` cards use elsewhere, tying this
  page back to its own gold "Start Here" card on the dashboard.
  `VideoPlaceholder.tsx` and `CalendlyPlaceholder.tsx` were both
  restyled to the black-box-with-a-white/10-circle-icon look SOPs'
  lesson video area already established, rather than their own
  one-off gray gradient. `NewStudentForm.tsx`'s fields now sit inside a
  proper `rounded-2xl border ... shadow-lg` card (previously just bare
  `<label>`s on the page background) — the form's own fields and submit
  behavior are unchanged. `NavigationTable.tsx` already matched this
  card language and didn't need touching. Verified visually via a
  headless-Chrome screenshot (temporarily adding this route to
  `PUBLIC_PATHS` for the run, fully reverted after — the same pattern
  used throughout this app for auth-gated pages).

  Underneath each tab's Calendly embed sits a **Typeform-style intake
  form** — `src/components/TypeformFlow.tsx`, one question fills the
  card at a time with a thin progress bar, a slide/fade transition
  between questions, number-key or click-to-select for multiple choice
  (auto-advances immediately, no separate "next" button), Enter ↵ to
  advance a short-text answer, and a back arrow to revisit the previous
  question — fully generic over a `questions: TypeformQuestion[]` array
  (`src/lib/intake-forms.ts`) so the same component backs both the CMO
  form (7 questions: offer status, niche, ad spend budget, ads
  knowledge, traffic source, monthly revenue, data tracking — all given
  verbatim) and the CEO form (no questions yet — `CEO_QUESTIONS` is
  empty and the CEO tab hides `TypeformFlow` entirely until it isn't).
  Submitting writes one row per (student, form) to
  `intake_form_submissions` (`0020_student_data.sql`) as a flat
  `{ [questionId]: answer }` jsonb blob — an `upsert` keyed on
  `(user_id, form)`, so resubmitting (via the "Edit your answers" link
  on the submitted state) overwrites rather than duplicating. RLS lets a
  student read/write only their own rows; admins can read (never write)
  anyone's, for the Student Data page below. The text-question's local
  draft state resets between questions via React's own `key={question.id}`
  remount (a small `ShortTextQuestion` subcomponent keyed by question id)
  rather than a `useEffect` syncing it — the same
  derive-instead-of-sync-in-an-effect fix applied elsewhere in this app,
  caught here by the same React Compiler purity rule mid-build.
- `src/app/dashboard/sops` — SOP hub, three levels deep: a department
  grid (Operations, Marketing, Sales, Fulfilment — hardcoded in
  `src/lib/sops.ts`, a fixed set of 4 with their own icons) → each
  department's list of SOPs → each SOP's sub-category sidebar with a
  video player and notes per lesson. Everything below the department
  level (SOPs, sub-categories, lessons) lives in the database
  (`0016_sops.sql`: `sops`, `sop_subcategories`, `sop_lessons`) rather
  than hardcoded, so admins (one-letter usernames — `is_admin()` from
  `0009_communications.sql`) can add, edit, and delete them; everyone
  else gets read-only access via the same RLS split used everywhere
  else "admin" means anything in this app (select policies open to any
  authenticated user, insert/update/delete policies gated on
  `is_admin(auth.uid())`). Mutations go straight from the browser to
  Supabase (`DepartmentSopsGrid.tsx`, `SopDetail.tsx`), the same direct-
  client pattern Communications and Profiles use, following the same
  optimistic-update-then-verify-a-row-came-back convention throughout.

  A lesson stores a video link (Loom or YouTube), a large free-text
  content block, and a list of named resource links — no PDF/file
  upload in this pass. `getVideoEmbedUrl()` (`src/lib/sop-types.ts`)
  turns a recognized Loom/YouTube URL into its embeddable form, rendered
  in an `<iframe>` in place of the old fixed "Loom video placeholder"
  box; an unrecognized host falls back to a plain "Watch video ↗" link
  instead of embedding an arbitrary URL, and no video link at all just
  shows "No video linked yet" (or "Select a lesson" before anything's
  picked). Underneath that sits **Content** — `sop_lessons.content`
  (`0017_sop_lesson_content_resources.sql`, renamed from the original
  `notes` column added in 0016 once it became clear a single short note
  wasn't enough): a large textarea for pasting whatever's needed,
  editable inline (pencil icon → textarea → Save/Cancel, the same
  pattern as the SOP title/description edit) rather than through the
  add/edit-lesson modal, which now only asks for title and video link.
  The read-only view renders saved content inside a bordered card
  (matching the sidebar's own `rounded-2xl border ... bg-white
  dark:bg-neutral-900` styling) rather than as bare text sitting loose on
  the page — the empty state ("Nothing here yet") gets a dashed-border
  version of the same card, so it doesn't look like an error either.
  Below that, **Resources** is a per-lesson list of named links
  (`sop_lesson_resources` — its own table since a lesson can have any
  number of them) an admin can add (title + URL) or remove; both
  Content and Resources are scoped to whichever lesson is selected, and
  both explicitly reset (`selectLesson()`) whenever the selected lesson
  changes so a half-written draft never leaks onto the next lesson you
  click into.

  Deleting a SOP or a sub-category cascades to what's inside it
  (`on delete cascade` on every relevant foreign key, all the way down
  to resources) and asks for confirmation first (`window.confirm`)
  since that's not cheaply undoable, unlike a single message delete
  elsewhere in the app which isn't guarded the same way.

  The `[department]` and `[department]/[sop]` routes dropped their
  `generateStaticParams` static generation (SOPs aren't known at build
  time anymore) and now render dynamically per-request, same as
  `/dashboard/communications`.
- `supabase/migrations/` — SQL to run in the Supabase SQL Editor. Sets up a
  `profiles` table (one row per user, holding their public `username`,
  3–20 chars, letters/numbers/underscores) auto-populated from the username
  entered at signup, plus row-level security so usernames are readable by
  everyone but only editable by their owner.
- `src/components/BugReportButton.tsx` + `src/lib/bug-report-actions.ts` —
  the "Submit a bug" button/modal on the dashboard, which emails
  tom@educatr.co via Resend.
- `public/tracking-app/index.html` + `src/app/dashboard/tracking` — the
  Metrics Tracking dashboard, ported from the `acqtom/tracking` repo. Served
  as a static file and embedded via iframe at `/dashboard/tracking` so it
  renders in complete CSS/JS isolation from the rest of the app. The
  original's password gate was removed (this route is already behind real
  login), and a pre-existing bug was fixed where typing a second digit into
  a metric cell would scramble the value (the table rebuilds on every
  keystroke and refocuses the new input without restoring cursor position —
  fixed by switching those inputs from `type="number"`, which can't have
  its selection set via JS, to `text`). The repo's OAuth integration
  backend (Typeform/Calendly/Meta/Whop) was *not* ported — it exists in
  that repo but was never actually wired into its frontend, so nothing
  there was actually live to duplicate.

  Originally fully client-side (all state in that one browser's
  `localStorage`, no backend at all) — this became a real blocker once the
  Sales Team Board needed to push numbers in here automatically, since
  there was no server-side place to push into. The metric *values* only
  (`data: { [metricId]: { [isoDate]: number } }`, the same shape
  `localStorage` already used) now sync to a per-user
  `metrics_tracking_state` row (`supabase/migrations/0008_...sql`) via
  `/api/tracking/session` + `/api/tracking/save`
  (`src/app/api/tracking/`) — targets, tab names, card order, and which
  funnel mode is displayed stay local/per-browser exactly as before,
  since those are view preferences the push doesn't need to touch. The
  page still boots instantly from `localStorage` as before, then layers
  the server sync on top asynchronously: on first load, if the server
  already has data it wins (overwrites local); if the server's empty but
  local storage has something, a one-time prompt offers to import it. A
  background poll (8s, plus on window focus) keeps this in sync with
  changes made elsewhere (another device, or a sales rep logging a call)
  — skipped entirely whenever any input on the page is focused, so it can
  never yank a value out from under active typing. A visible banner
  surfaces any load/save failure instead of failing silently, the same
  fix applied to the Sales Board earlier.

  The Sales Team Board's Post Call Form now has a required VSL/Webinar
  funnel picker (above the Outcome picker, also editable per-deal from
  the Data view's edit modal) — see `src/lib/metrics-tracking-state.ts`
  for the push logic, called from `/api/sales-board/save` and `/by-code`
  whenever a save includes `deals`. It recomputes, from scratch, every
  metric that funnel's `deals` data can actually fill, for every date any
  current deal touches, using the exact same field derivations and
  formulas the Sales Team Board's own KPI grid uses
  (`renderBasePage()` in `public/sales-board-app/index.html`):

  - **VSL** (11 metric ids): `cash`, `revenue_gen`, `units` (closed-deal
    sums/count), `calls_cal` (Calls On Calendar — deals where `isCall !==
    false`), `calls_show` (of those, `calendarStatus === "showed"`),
    `show_rate` (`calls_show ÷ calls_cal`), `dq_rate` (`disqualified`
    count ÷ `calls_show`), `close_rate` (`units ÷ calls_cal`),
    `cash_per_call` (`cash ÷ calls_show`), `aov` (`cash ÷ units`), and
    `depos` (closed deals where `paymentMethod === "Deposit"`).
  - **Webinar** (7 metric ids): `total_revenue`, `deals_closed` (closed-
    deal sum/count), `calls_booked` (Webinar's "Calls On Calendar"
    equivalent), `calls_shown`, `show_rate_call`, `close_rate_webinar`,
    `aov_webinar` — same formulas as VSL's `show_rate`/`close_rate`/`aov`,
    just against Webinar's own call counts. Webinar has no DQ-rate metric
    id at all in `WEBINAR_METRIC_META`, so there's nothing to push there.

  `close_rate`/`aov` exist as metric ids in **both** funnels'
  `*_METRIC_META` lists in `public/tracking-app/index.html`, but
  `metrics_tracking_state.data` stores values flat as `{ [metricId]: {
  [isoDate]: number } }` with no funnel dimension — so before this pass,
  a VSL deal and a Webinar deal closing on the same date would have
  silently overwritten each other's `close_rate`/`aov` number. Per
  explicit direction that a deal's numbers only ever affect the funnel
  chosen on its own Post Call Form, Webinar's copies were renamed to
  `close_rate_webinar`/`aov_webinar` (in `WEBINAR_METRIC_META`,
  `WEBINAR_CARD_DEFS`, and `FUNNEL_CONFIGS.webinar.defaultTrend`) so the
  two funnels can never collide — VSL keeps the original `close_rate`/
  `aov` ids unchanged. One caveat worth knowing: any Webinar close
  rate/AOV value typed in by hand *before* this rename was stored under
  the old shared `close_rate`/`aov` ids, so it won't show up under
  Webinar's new ids afterward — there's no way to tell, from the stored
  data alone, which of those old entries were meant for VSL versus
  Webinar, so nothing was auto-migrated.

  `wasCall`/`calendarStatus`/`disqualified` all fall back to deriving the
  same value `dealFieldsFromForm()` would have computed from `callOutcome`
  alone, for deals saved before those fields existed — same spirit as
  funnel-less deals already defaulting to VSL. Recomputing rather than
  incrementing means an edited or deleted deal is reflected correctly,
  not just additive, per explicit direction to have this overwrite/
  recompute rather than add on top — and since it recomputes off every
  currently-known deal on every save, a later formula fix (see below)
  retroactively corrects *all* historical dates the next time anything is
  saved, not just newly-touched ones. A `sales_board_dates` column (not a
  key inside `data` itself) separately tracks which dates this feature
  has actually written to, per funnel mode — without it, there'd be no
  way to tell "a date I previously pushed to that now has no qualifying
  deals" (should be zeroed) apart from "a date the user manually typed a
  number into under one of these same metric ids, that no deal has ever
  touched" (must never be touched); every other metric a person enters by
  hand (ad spend, CPC, and so on) is never touched by this either way.
  The by-code (secret-key) save path resolves the code to its owning
  user's id via `get_sales_board_owner_id` (0008_...sql, SECURITY
  DEFINER) before pushing — safe to expose, since whoever already holds a
  valid code has full read/write on that account's sales data via the
  existing by-code RPCs anyway.

  One real, pre-existing quirk worth knowing about, inherited directly
  from the Sales Team Board's own model rather than introduced here:
  `calendarStatus` is only ever `"showed"` for anything counted in
  `calls_cal`/`calls_booked` at all — a No-Show/Cancelled/Rescheduled
  outcome sets `isCall = false` (per `dealFieldsFromForm`'s own comment,
  those "happen before the closing call ever takes place"), which
  excludes it from the calendar-call count entirely rather than counting
  it as a booked call that didn't show. So `show_rate`/`show_rate_call`
  will read 100% whenever there's at least one calendar call that day —
  that's what the board's own KPI grid shows too, not a bug in the push.
  This *did* fix a real, narrower bug in what was pushed before: the old
  `calls_show`/`calls_shown` push used `callOutcome !== "No-Show"` as a
  rough stand-in, which wrongly counted Cancelled/Rescheduled/Remainder-
  Collection deals as "shown" — the new formula matches the board's real
  `calendarStatus === "showed"` definition exactly.

  Verified with a standalone unit test against `mergeSalesBoardMetrics`
  (25 assertions, run by compiling the function with `tsc` and executing
  it directly with `node` — no Next.js/Supabase runtime needed since the
  function itself is pure): every VSL and Webinar formula above against
  hand-computed expected values on a day with a realistic mix of outcomes
  (closed via deposit, closed via paid-in-full, No Close, Disqualified,
  No-Show, Cancelled), confirmed a same-day VSL deal and Webinar deal
  never leak into each other's numbers (including `close_rate`/`aov` vs.
  `close_rate_webinar`/`aov_webinar` specifically), confirmed a deal
  missing `funnelType`/`isCall`/`calendarStatus`/`disqualified` entirely
  (a legacy deal) still computes correctly via the `callOutcome`-based
  fallbacks, and confirmed recomputing after a deal's removal zeroes out
  exactly the counts that deal contributed rather than leaving stale
  values. This repo's existing Puppeteer coverage of the funnel picker,
  Data table Funnel column, edit-modal pre-fill, server-seeded row
  rendering, one-time import prompt, and focused-input poll guard (from
  when the funnel picker itself first shipped) is unaffected by this
  change and wasn't re-run.
- `src/app/dashboard/accounting` — the Accounting Hub, ported natively (real
  React components, not an iframe) from the `acqtom/accounting` repo. Fully
  self-contained client-side (state in `localStorage`); loaded via
  `next/dynamic({ ssr: false })` since that state doesn't exist during
  server rendering. The original's passcode gate was dropped for the same
  reason as tracking's.

  The PnL statement was simplified from the original's per-client
  revenue/equity/bonus model down to: one Revenue number; expenses as
  Editor (manual), Ad Spend (manual), Processing Fees (manual), Setter
  (fixed 5% of revenue), and Closer (fixed 10% of revenue), plus any
  number of free-form name/amount expenses; Net Profit = Revenue − Total
  Expenses. NZD was dropped entirely (USD only). `lib/storage.ts`
  migrates months saved under the old per-client shape into the new one
  on load — and, notably, expenses here were never a fixed category enum
  to begin with (they're free-form `{id, name, amount}` line items), so
  Processing Fees becoming a real field (rather than something someone
  could already type into "+ Add expense") is specifically because it's
  meant to behave like Editor/Ad Spend: a dedicated row, present every
  month, that **carries its dollar amount forward** month to month
  (`createDefaultMonth` in `lib/storage.ts`) rather than resetting to 0
  the way Revenue does.

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
  Processing Fees specifically: confirmed the row renders between Ad
  Spend and Setter, and that entering an amount flows straight through
  to Total Expenses and Net Profit.
- `public/daily-kill-list-app/` + `src/app/dashboard/daily-kill-list` — the
  Daily Kill List. Originally two separate ports (Daily Kill List, from
  `acqtom/todo` "Focus Engine", and the standalone Prioritization Task
  Backlog, from `acqtom/backlog`) that were later merged into one card at
  the user's request. Static HTML/CSS/JS, embedded via iframe as usual.

  Two independent state slices, each keeping its source app's original
  sync architecture. Both were originally one shared team-wide board
  (a singleton row everyone read/wrote) but were made **private per
  account** by `0018_private_daily_kill_list.sql`, at the user's
  explicit direction, once it became clear the cross-referencing across
  accounts wasn't wanted — matching every other feature in the app
  except Communications:
  - **Day-scoped** (changes with the date-nav up top): Daily Calls (with
    repeat schedules) and a per-day Braindump. Cross-device sync via
    `/api/daily-kill-list/state` → this user's own row in
    `daily_kill_list_state` (`id uuid references auth.users(id)`, RLS
    `auth.uid() = id`), cached in each browser's `localStorage` for
    instant offline access with a debounced background push —
    unchanged from the original Daily Kill List other than the
    ownership model. The original's needle-mover tasks, per-client
    to-do cards, and revenue/streak tracking were dropped (superseded
    by the backlog below, or just removed) at the user's request; their
    old data isn't deleted from the stored JSON on save, just no longer
    read or rendered, so nothing already entered there is destroyed by
    the merge.
  - **Persistent** (ignores the date-nav — this user's own ongoing
    list): the backlog and Yearly Goals, via
    `/api/daily-kill-list/backlog` → this user's own row in
    `task_backlog_state`. Same GET-latest → mutate → POST round-trip
    per change, no local cache, as the original Task Backlog. Its client
    (Adriel/Alex) and per-assignee (Tom/Derek) routing was replaced with
    four fixed departments — Marketing, Sales, Operations, Fulfilment —
    each getting its own to-do card alongside the main filterable Backlog
    list; the per-task assignee dropdown is gone, but level (High/Medium/
    Low), the top-priority ⭐, and repeat-on-add are unchanged. Any task
    saved under the old client/assignee schema before the merge shipped
    still loads (nothing is deleted), defaulting to Marketing until
    manually re-filed.

  Each task row (`makeTaskRow()` in `app.js`) groups its level/
  department/repeat badges + star + delete button into one `.task-meta`
  wrapper div, and `.task-row` is `flex-wrap: wrap` with
  `justify-content: space-between` (`styles.css`) — on a wide row
  everything sits on one line as before, but on a narrow one (the
  per-department to-do cards especially) the whole badge cluster wraps
  onto its own line below the task text instead of squeezing
  `.task-text` down to near-zero width, which used to force
  `word-break: break-word` to wrap one character per line. If even the
  wrapped badge cluster doesn't fit the card's width, `.task-meta` wraps
  again internally. Verified with a standalone headless-Chrome
  screenshot of the exact markup/CSS at both a wide (~650px, stays on
  one line) and a very narrow (~190px, text wraps normally and the badge
  row splits across two lines) width.

  `0018_private_daily_kill_list.sql` drops and recreates both tables
  rather than migrating the id column in place — the singleton-to-
  per-user conversion has no way to attribute the old shared content to
  any particular account, so per the user's own call it isn't carried
  forward; every account starts with an empty Daily Kill List and
  backlog after that migration runs. Both API routes
  (`src/app/api/daily-kill-list/state/route.ts` and
  `.../backlog/route.ts`) now call `auth.getUser()` and key every
  read/write off `user.id` instead of the old fixed `id: 1`, the same
  auth pattern `/api/sales-board/save` already used.

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
  no existing app to preserve behavior from. Four tabs: a Kanban board
  (Idea → Scripting → Filming → Editing → Published columns, native HTML5
  drag-and-drop between them, no library; each card also carries a
  High/Medium/Low priority, chosen when adding it and editable anytime
  after via a colored pill-select on the card, defaulting to Medium, plus
  an optional due date set the same way — a hidden native date input
  behind a clickable pill, blue while upcoming and turning red once
  past-due), Content (a left sidebar of documents — seeded on first visit
  with the existing YouTube/Instagram/Ads planning template, minus the
  "Directory" entry and the four "<X>: Asset Hub" entries, both dropped
  at the user's request after the first pass — each opening a plain title
  + free-text body editor on the right, except the one seeded "Drive hub"
  document, which instead gets a fixed-id (`DRIVE_HUB_DOC_ID` in
  `types.ts`, not the random id every other document has, so it survives
  reloads) `driveHub` field rendering `DriveHubTable.tsx`: four cards
  (Youtube video #1/#2, Instagram Reels, Meta Ads) in a responsive
  two-column grid that fills the available width, each row an editable
  folder-name field with a 📁 icon — no real Drive links wired up yet,
  just the structure and editable names, per explicit direction that the
  rest comes later. Styled with the same neutral white/gray card language
  as the rest of the app, not the source planning sheet's blue/tan
  spreadsheet colors, which didn't match — narrow single-column and
  spreadsheet-colored on the first pass, corrected after explicit
  feedback. Seven other seeded documents get their own fixed-field card
  layout instead of the plain editor too (`ContentTemplates.tsx`,
  dispatched by a `ContentDoc.templateType` set in `defaultDocuments()`,
  reading/writing a flat `templateData: Record<string, string>` — field
  labels and instructions live in code, only the values are user-edited,
  matching Drive Hub's "fixed structure, editable content" pattern). Every
  field/textarea in these templates carries a "Type here…" placeholder and
  a light gray focus background — the first pass left them fully
  transparent, which read as plain (non-editable) labels rather than
  inputs, corrected after explicit feedback ("I need to be able to edit
  these"). The two "<X>: Overview" docs get `videoOverview` (a 7-field
  overview table, then `ProductionNotes` — 8 instructional note cards:
  Loom Overview, Example, Story & WHY, Persona/Like/Know/Trust, Proof &
  Receipts, B-Roll Needed, Energy & Delivery, Other Notes — each pairing a
  fixed title/instruction with an editable textarea); "Ads: Overview" gets
  the new `adOverview` (a 6-field ad batch overview table, then that same
  `ProductionNotes` component reused verbatim, per explicit direction —
  initially left as a plain editor since no reference screenshot covered
  it, built once one was provided); the two "<X>: Script" docs get
  `videoScript` (HOOK → Point 1 → Point 2 → Mid-Video CTA → Point 3 →
  Point 4 → End CTA); the two "<X>: Title / Thumb" docs get `titleThumb`
  (4 brainstorm rows + an SEO Ranking table, then 2 fixed Title×Thumbnail
  Combination cards, each with Face/Text/Elements/Objects/Location
  sub-fields); both Instagram docs share one `ScriptSequenceTemplate`
  component parameterized by a `blockLabel` prop — "Instagram: Scripts"
  gets `instagramScript` (Loom Overview + 3 "Script #N" blocks),
  "Instagram: Stories" gets `instagramStories` (identical shape, "Story
  Sequence #N" instead — the source screenshot's own labels were
  inconsistent between blocks, this standardizes them); "Ads: Scripts"
  gets `adScript` (a 6-field campaign overview, then Hooks H1–H5 / Body
  B1–B3 / Closes C1–C2 tables with narrow row labels).
  Content Calendar (`ContentCalendarTab.tsx`) — a 7-day ×
  N-column weekly-rhythm grid, each cell a free-text textarea, seeded
  with 5 starting columns matching the Kanban board's own stage names
  (Idea/Scripting/Filming/Editing/Published — shared label text only, not
  a live link back to Kanban). Cells themselves start genuinely empty —
  an earlier pass had seeded them with the user's real example weekly
  schedule (from the reference screenshot) as a head start, but that read
  as placeholder content rather than something to build on, so it was
  dropped entirely at the user's explicit follow-up ("the calendar is not
  empty"); same reasoning killed the "—" placeholder dash on empty cells
  a step before that. Columns are user-defined, not fixed:
  `CalendarColumnDef { id, label }` in a `columns` array (state also
  carries `cells[day][columnId]`, so deleting a column also prunes it out
  of every day's cells), add via a "+" cell at the end of the header row,
  rename inline like every other editable label in this app, remove via a
  hover ✕ — a rotating color palette (`DOT_PALETTE` in
  `ContentCalendarTab.tsx`) assigns each column's header dot by position
  so newly-added columns automatically get a distinct color with no user
  configuration. Deliberately restyled away from the source spreadsheet
  screenshot's literal blue/tan/pink/green cell-fill colors into the
  app's own card language — small colored dots on the column headers
  instead, per explicit "make it way better than this" direction — and
  Team
  (`TeamTab.tsx`) — a small name + stage table; each saved member shows
  as a "Responsible: <name>" label under that stage's Kanban column
  header (one general owner per column, not a per-card assignee —
  multiple members on the same stage are comma-joined).

  Like almost everything else in this app (Communications is the one
  deliberately shared exception), this is **private per account**, per
  the user's explicit call. Backed by `content_hub_state`
  (`supabase/migrations/0005_...sql`) — one JSON blob per user,
  RLS-gated to `auth.uid() = id` — behind `/api/content-hub/state`
  (`src/app/api/content-hub/state/route.ts`). Local React state with a
  debounced save + background poll, same shape as Daily Kill List's
  day-scoped side, just per-user instead of localStorage-cached. That
  route also generates a 5-character access code the first time it runs
  for a given user (`ensureRow()`, retrying on the astronomically unlikely
  case of a collision), so every account has one from day one without a
  separate migration trigger to backfill existing users.

  A teammate without a portal account can still reach one specific
  person's hub with full edit rights via that code, no login at all: enter
  it at `/team-access` (linked from `/login`, and shown to the owner at
  the top of their own Team tab, alongside the full `/team-access` URL
  itself — both with their own copy button, since the owner needs to hand
  their team both pieces to actually get in, derived client-side from
  `window.location.origin` so it's correct on whatever domain the app is
  actually running on rather than a hardcoded one) and it resolves through
  `/api/content-hub/by-code` → two `SECURITY DEFINER` Postgres
  functions (`get_content_hub_by_code` / `save_content_hub_by_code`, in
  the same 0005 migration) that look up or overwrite exactly one row's
  data by its code and return nothing else about that row — the RLS
  bypass is scoped to those two narrow functions rather than a
  service-role key, consistent with how every other feature in this app
  avoids needing one. `src/app/dashboard/weekly-content-hub/ContentHubApp.tsx`
  takes a `mode: "owner" | "code"` prop and points its fetches at whichever
  endpoint applies; `/team-access/[code]/page.tsx` renders the same
  component in code mode.

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
  removing a member updated the table correctly. After the secret-key
  access was added: confirmed the owner's Team tab displays a generated
  code, then — with `/team-access` and `/api/content-hub/by-code` both
  genuinely public, so no middleware changes were needed for this part —
  entered that code in lowercase at `/team-access` and confirmed the app
  normalizes it to uppercase before redirecting to `/team-access/<CODE>`,
  confirmed the resulting page loads that same account's real documents
  and lets a fully anonymous session add a Kanban card with the change
  persisting, and confirmed an unknown code shows "Invalid or unknown
  secret key" instead of silently failing. After priority was added to
  Kanban cards: since `/team-access` needs no middleware changes to test,
  added a card with High priority selected and confirmed it saved with
  the right value and red pill styling, changed an existing card to Low
  and confirmed the pill updated, and confirmed a card added without
  touching the priority selector defaults to Medium. After a due date was
  added: added a card with a future date and confirmed the pill showed
  that date in blue, changed it to a past date and confirmed the pill
  turned red, and confirmed a card added without setting a date shows the
  "Due date" placeholder pill instead of a blank/broken one. After the
  Drive Hub table was added: confirmed all four section headers and all
  21 rows across them render in the right order matching the source
  planning sheet, edited a folder-name field and confirmed the value
  updates and holds, and confirmed every other document (e.g. Directory)
  still shows the normal plain-text editor rather than the table. After
  the four "Asset Hub" entries (one per Youtube/Instagram/Ads section)
  were dropped from the default template at the user's request: confirmed
  the sidebar seeds exactly the remaining 15 items in the same order,
  divider rows included. After the Content Calendar tab was added and
  "Directory" was dropped from the template too: caught and fixed a real
  bug before shipping — the initial "does this need seeding" check used
  `data.contentCalendar.cells` truthiness, which is true even for a
  brand-new row's genuinely empty `{}`, so a first-time user would never
  have seen the real starting template at all; fixed by checking for at
  least one actual day key instead (`hasCalendarData()`). Confirmed the
  tab order is Kanban Board → Content → Content Calendar → Team, confirmed
  all 17 non-empty seeded cells match the real weekly rhythm exactly,
  edited a cell and confirmed it holds, and confirmed the Content tab's
  sidebar no longer has a "Directory" entry. After columns became
  user-defined instead of a fixed 4: `hasCalendarData()` was updated to
  check `columns.length` instead of cell keys (more direct, and correct
  now that an added column with still-empty cells must count as
  "already seeded"). Confirmed the 4 default columns still render in
  order, added a 5th column and confirmed the grid reflowed to 5 equal
  data columns without breaking the fixed day/add-button columns,
  renamed it inline, typed into one of its cells, and deleted a column
  and confirmed the grid correctly dropped back to 4. After the default
  columns were changed to match Kanban's stage names and the placeholder
  dash was removed: confirmed the 5 default columns read exactly
  Idea/Scripting/Filming/Editing/Published in order, confirmed no
  textarea has a placeholder attribute anymore, confirmed all 17 seeded
  cells landed under the correct remapped column (e.g. "Sent" now under
  Idea instead of the old "New Content"), and confirmed renaming still
  works post-remap. After the seeded example data was dropped entirely:
  confirmed all 35 cells (7 days × 5 columns) are genuinely empty
  (`cellValues.some((v) => v !== "")` is false) while the 5 column labels
  still read correctly — all matched expectations with zero console
  errors. After the six structured document templates were added:
  visited all six template documents plus "Ads: Overview" and confirmed
  each renders its own distinct structure (checked for template-specific
  landmark text like "Loom Overview:", "MID-VIDEO CTA", "Brainstorm #1",
  "Combination #2", "Story Sequence #3", "Closes:"/"C2") while "Ads:
  Overview" still shows the plain `textarea[placeholder='Start writing…']`
  untouched, typed into the Video Overview's "Video Concept:" field and
  confirmed the value holds — all matched expectations with zero console
  errors. After the field-editability styling fix and the new
  `adOverview` template: confirmed "Ads: Overview" now renders
  "Campaign Concept:" plus the full "Notes for Production / Filming"
  section (same landmark text as Video Overview: "Loom Overview:",
  "Proof & Receipts:") instead of the old plain textarea, confirmed a
  representative field's placeholder now reads "Type here…", and typed
  into that field to confirm the value both holds and shows the new focus
  background — all matched expectations with zero console errors. After
  the Team tab's secret-key card was extended to also show the
  `/team-access` URL: confirmed it resolves to the page's actual origin
  (`http://localhost:3000/team-access` in dev, matching whatever domain
  it's really deployed on) rather than a hardcoded string, and confirmed
  it and the key each still have their own working copy button — matched
  expectations with zero console errors. Also fixed a real bug surfaced
  by the SQL rollout: the Weekly Content Hub's owner-mode load/save
  failures only logged the real error to console, leaving the on-page
  status as an undiagnosable generic "Sync error" (the same gap already
  fixed on Daily Kill List earlier, missed here) — now the actual message
  is included in the status text for both paths.
- `public/sales-board-app/` + `src/app/dashboard/sales-board` — the Sales
  Team Board, ported from `acqtom/salesboard`: a sales & commissions
  dashboard (KPI tiles, call-outcome/cash charts, a Post Call Form,
  commission tracking by closer/setter, and a raw data table with an edit
  modal) — a single self-contained `index.html`, no external
  dependencies, embedded via iframe as usual.

  The original app gated itself with a fixed 3-account (Alex/Adriel/Des)
  offer+password login, each account holding entirely separate
  deals/closers/setters. First pass kept that login screen (reasoning: it
  wasn't a redundant gate duplicating the portal's own Supabase Auth, it
  was how the app picked *which* account's data you saw). Per explicit
  follow-up ("This is ONE dashboard for the user and their account.
  Privately") that whole account concept was removed instead: no login
  screen, no offer/password, no `current-user-label`/logout button — the
  portal's own Supabase Auth session is the only identity, exactly like
  the Weekly Content Hub. `src/lib/sales-board-auth.ts` (the fixed
  3-account list) was deleted entirely once nothing referenced it anymore.

  Backed by `sales_board_state` (`supabase/migrations/0006_...sql`) — one
  JSON blob per user (`id` referencing `auth.users`, RLS gated to
  `auth.uid() = id`), same design as `content_hub_state`, replacing both
  the original's Upstash Redis keys (`deals:<offer>` etc.) *and* its
  fixed-account model at once — behind `/api/sales-board/session` and
  `/api/sales-board/save` (`src/app/api/sales-board/`), which read the
  caller from the session cookie via `supabase.auth.getUser()` instead of
  a request-body offer/password. `save/route.ts` still merges the given
  fields over the row's existing data before writing, since the client
  only ever sends the fields that changed (one of deals, or
  closers+setters together) — mirroring the original's one-Redis-key-per-
  field granularity even though Supabase holds all three in a single
  jsonb column. Both routes share `ensureSalesBoardRow`
  (`src/lib/sales-board-state.ts`), which creates the row (with a fresh
  access_code, see below) on first touch rather than assuming it exists.

  A save-failure bug was found and fixed after the initial port: save
  errors (a session hiccup, a network blip) were only logged to the
  console, so the UI would claim success even when nothing actually
  persisted — worse, if the *initial* load ever failed, the app booted
  anyway with an empty local `deals` array, and the next save would have
  overwritten the account's entire history with just that one new entry
  (a save always sends the whole array). Fixed with a `dataReady` flag
  that blocks saves until a load has actually succeeded, plus a visible
  `#sync-banner` that surfaces any load/save failure instead of failing
  silently.

  An **Add Team** tab (`view-team` inside `index.html`) was added next,
  replacing the old inline "+" buttons that used to sit next to the Post
  Call Form's Closer/Setter fields (a browser `prompt()` each) with a
  proper add/remove UI, plus a secret-key sharing flow of its own —
  separate from the Weekly Content Hub's, so one key doesn't grant access
  to the other. `0007_sales_board_access_code.sql` adds an `access_code`
  column (generated by `ensureSalesBoardRow`, same as Content Hub's
  `access_code`) and two `SECURITY DEFINER` functions,
  `get_sales_board_by_code` / `save_sales_board_by_code`, reached through
  `/api/sales-board/by-code` (`src/app/api/sales-board/by-code/route.ts`)
  and the `/sales-access` + `/sales-access/[code]` pages (mirroring
  `/team-access`, but the `[code]` page just points the same
  `sales-board-app/index.html` iframe at `?code=...` instead of rendering
  a separate React component, since the sales board — unlike Content
  Hub — is a static app, not a React one). The save function does a
  shallow jsonb merge (`data || p_patch`) rather than a full overwrite,
  to preserve the same partial-save semantics as the session-cookie path.
  Inside `index.html`, a `?code=` in the URL routes every load/save
  through `/api/sales-board/by-code` instead of the session-based
  endpoints — the only branch point in the whole file; every other view,
  including Add Team itself, behaves identically in both modes.

  An **Onboarding** tab (`view-onboarding`) followed — a reference doc
  for bringing on new reps, split into three cards (Main Breakdown /
  Closer SOPs / Setter SOPs), each its own row of sub-tabs (e.g. Closer
  SOPs ships with Daily Process/Responsibilities/Script/Onboarding/
  Deck/Closer Tracking/Financing already there) with a single shared
  textarea beneath showing whichever tab is selected. Every tab's
  `content` starts blank — only the *labels* are seeded defaults, per
  explicit instruction — and more tabs can be added (an inline form, not
  a `prompt()`, matching the precedent Add Team already set) or removed
  freely; removing the last tab in a section is blocked so a section can
  never end up with zero tabs. Saved as a new opaque `onboarding` field
  on `SalesBoardData` (`src/lib/sales-board-state.ts` — the shape is
  only ever interpreted client-side, so no migration was needed; the
  existing `save_sales_board_by_code` function's generic `data ||
  p_patch` jsonb merge already supported an arbitrary new top-level key
  with zero SQL changes), threaded through `/api/sales-board/save`,
  `/session`, and `/by-code` the same way `dailyCashTarget` was.

  A poll landing while a rep is mid-typing in an SOP's textarea must
  never overwrite it (the same class of bug fixed earlier for the sync
  banner), but a *user clicking a different tab* must always update that
  same textarea immediately — two different callers of the same render
  function needing opposite behavior around "is this textarea focused
  right now." Solved with an explicit `preserveFocused` flag passed only
  by the periodic/focus poll, not by tab-click/add/remove handlers: a
  Puppeteer run initially caught this exact bug (switching tabs silently
  kept showing the *previous* tab's content, because the poll's
  "don't-clobber-active-typing" guard was firing on every render
  regardless of what triggered it) before the flag was added.

  Verified via Puppeteer across all of the above (fetch mocked against
  each endpoint in turn, matching its exact contract, since a real login
  session isn't available headlessly): confirmed the no-login dashboard
  loads immediately with seeded data rendering correctly in the Deals
  Closed/Set breakdowns and Data view; confirmed a failed initial load
  and a failed save each surface the sync banner and that a normal
  load/save cycle never shows it; confirmed the Add Team tab renders the
  right domain/secret-key values, that adding or removing a closer/setter
  updates the Post Call Form's dropdowns and fires a save with the
  correct partial payload, and that the "+" buttons are gone from the
  Post Call Form; confirmed a `?code=` session never once calls the
  session-cookie endpoints, only `/api/sales-board/by-code`; and for
  Onboarding, confirmed all three sections' default tab labels and blank
  content, that typing debounce-saves the full `onboarding` object,
  that switching tabs correctly shows each tab's own (initially blank)
  content and preserves what was typed when switching back, that adding
  and removing a custom SOP tab both work and persist, and that a
  background poll firing mid-keystroke never clobbers the textarea while
  it's focused. Two KPI figures ($ sums, commission amounts) read wrong
  in earlier passes — traced to the test's own synthetic seed data using
  field names (`outcome`, `date`) that don't match what the real form
  actually submits (`callOutcome`, `closingDate`, plus per-deal
  commission rates), not a defect in the port. Zero console errors in
  every run.

  The top filter bar (date preset, Call Outcome, Closer, Setter —
  `FILTER_FIELDS`/`renderFilters()`/`passesFilters()`) got a **Source**
  filter for VSL vs. Webinar, sitting right after the date preset. It
  slots into the same fully generic system the other three fields
  already use — no special-casing needed in `renderFilters`/
  `passesFilters` themselves — via two small per-field hooks added for
  it: `value` (a deal → filter-value function, so a legacy deal with no
  `funnelType` still filters as VSL, matching the default used
  everywhere else in this app) and `options` (a fixed `["vsl",
  "webinar"]` list rather than one derived from whatever's actually in
  `deals`, so both choices always show up even before any Webinar deal
  exists). `format` renders the checkbox labels as "VSL"/"Webinar"
  rather than the raw stored strings. Verified with a standalone test of
  `passesFilters`/`FILTER_FIELDS`' value-resolution logic (13 cases:
  fixed options list independent of `deals` content, correct label
  formatting, a legacy no-`funnelType` deal filtering as VSL, a Webinar
  deal correctly excluded when Source=VSL is active and vice versa, no
  filter selected passing everything through, and Source composing
  correctly alongside an existing Closer filter) — run the same way as
  Metrics Tracking's `mergeSalesBoardMetrics` test, compiled with `tsc`
  and executed with plain `node`, no browser needed since this slice of
  logic has no DOM dependency.

- `src/app/dashboard/communications` — the Communications Hub: open
  channels (any user can post, only admins create new ones) plus a private
  1-1 DM per regular user shared across every admin (a support-inbox
  model — any admin can read/reply, not fixed to one specific admin), all
  history kept forever, photo attachments, live delivery via Supabase
  Realtime. Unlike every other feature in this app, "admin" isn't a role
  column anywhere — it's simply having a **one-letter username**
  (`is_admin()` in `0009_communications.sql`, checking
  `length(username) = 1`), which is also why this needed no new setup: the
  original owner account was already seeded with the username `t` back in
  `0002_..._seed_tom.sql`, well before this feature existed.

  Architecturally the biggest departure from the rest of this app: every
  other feature reads/writes through its own `/api/*` Next.js route with
  the browser only ever calling `fetch`, and refreshes via polling (5–8s
  intervals). Communications instead has the browser talk to Supabase
  **directly** — `src/lib/supabase/client.ts`'s browser client, used from
  `CommunicationsApp.tsx` (a `"use client"` component) for every read,
  write, and photo upload, with RLS as the only thing standing between a
  user and someone else's data. This is a deliberate exception, not a
  new default: `/api/*` routes exist elsewhere partly to keep business
  logic (merges, pushes into other tables, access-code generation) off
  the client, none of which applies here, and polling would add a
  genuinely bad multi-second lag to something that's supposed to feel
  like a live chat. Live updates come from `.channel().on("postgres_changes",
  ...)` subscriptions (a WebSocket, not `fetch` — so unlike every other
  feature's testing, this one's live-update path can't be verified by
  mocking `window.fetch` in a headless run at all) — one for new
  channels appearing globally, one for new messages in whichever
  conversation is currently open, re-subscribed on every switch.

  Schema: `conversations` (`type` is `'channel'` or `'dm'`; a channel has
  a `name`, a dm has a `dm_user_id` pointing at the regular user it
  belongs to, enforced one-per-user by a partial unique index) and
  `messages` (`conversation_id`, `sender_id`, `body` and/or `image_path`
  — at least one required). Every DM row is created automatically by an
  `AFTER INSERT` trigger on `profiles` the moment a regular (non-admin)
  user's profile exists — including a one-time backfill for accounts that
  predate this migration — so an admin sees every team member listed
  immediately, not only after that person opens Communications for the
  first time. RLS: anyone authenticated reads/posts in any channel;
  a DM's own user or any admin reads/posts in that DM; only admins insert
  new channel rows, and only as themselves (`created_by = auth.uid()`,
  closing a gap the first draft's RLS left open); DM rows are never
  inserted by any client at all, only by the trigger. Photos live in a
  public `chat-uploads` Storage bucket (not signed URLs — a deliberate
  simplicity trade-off given this is low-sensitivity internal team chat
  and paths are random UUIDs) with `file_size_limit`/`allowed_mime_types`
  enforced by Storage itself (8MB, image types only), not just the
  client-side checks in `CommunicationsApp.tsx` — those exist purely for
  a fast, friendly error rather than a failed upload.

  The dashboard's existing **Communications** card used to link out to
  `comms.paidcoaching.com`; its `href` in `src/lib/cards.ts` now points at
  `/dashboard/communications` instead. Pointing the external subdomain
  at this route (if that's still wanted) is a DNS/hosting change outside
  this repo.

  Verified via `next build`'s type-check (catching most of the query/prop
  shape issues a feature this Supabase-query-heavy is prone to) and a
  careful manual re-read rather than the Puppeteer fetch-mocking used for
  every earlier feature — direct Supabase calls plus a WebSocket
  subscription aren't practically mockable the way a handful of REST
  endpoints are, and there's no seeded database yet to test against for
  real. Confirmed the route itself builds cleanly and correctly redirects
  an unauthenticated request to `/login`. One real bug was caught and
  fixed before this reached that point: an initial version called
  `setMessagesLoading(true)` synchronously at the top of the message-load
  effect, which `react-hooks/set-state-in-effect` flags for the same
  reason it did in `TeamTab.tsx` earlier — fixed by deriving the loading
  state (`activeId !== messagesConversationId`) instead of tracking it as
  separate state set inside the effect. This is a first draft awaiting a
  real end-to-end pass once the migration is actually run: sending a
  message, uploading a photo, confirming it arrives live in a second
  session, and admin vs. regular-user visibility of channels and DMs all
  still need to be checked by hand against the live project.

  Once the migration ran and Realtime was confirmed working live, three
  more pieces landed: **soft-delete** (`0010_message_delete.sql`) — a
  trash icon appears on hover for a message's own sender or any admin,
  optimistically hides it locally, then confirms via a `deleted_at`
  UPDATE (RLS-gated, and a trigger blocks any UPDATE that touches
  `body`/`image_path`/`sender_id`/`conversation_id`, so this route can
  never become message *editing*); the realtime subscription now listens
  for `UPDATE` as well as `INSERT` so a delete from another tab/session
  shows up live too. **@mentions** — typing `@` in the composer opens an
  autocomplete (arrow keys + Enter/Tab to pick, Escape to dismiss,
  built on every known username fetched once from `profiles`) that
  inserts `@username `; rendered messages highlight any `@word` token
  that matches a real username (gold for an admin's own `@t`-style
  mention name is unrelated — that's the sender label, not a mention —
  regular mentions render in indigo). This only highlights and
  autocompletes; there's no notification system yet, so a mention
  doesn't alert anyone who isn't already looking at that conversation.
  The mention dropdown's option buttons use `onMouseDown` +
  `preventDefault()` rather than `onClick`, deliberately — a `click`
  fires after the textarea has already blurred, which would make
  `selectionStart` unreliable for splicing the mention into the right
  spot in the text.

  Last, the dashboard's Communications card (`src/components/
  DashboardCard.tsx`, given a new `unread` prop alongside its existing
  `gold` accent, both mutually exclusive — a card is at most one of gold/
  green) turns green with a "NEW MESSAGES" label when
  `has_unread_communications()` (`0011_conversation_reads.sql`) says so.
  This needed *per-conversation* read tracking, not one "last opened
  Communications" timestamp for the whole user — someone who read channel
  A today but has never opened channel B, which has an older unread
  message, must still see the badge; a single global timestamp would
  have cleared it incorrectly. `conversation_reads` (`user_id,
  conversation_id, last_read_at`) is written by `CommunicationsApp.tsx`'s
  new `markRead()`, called both when a conversation's messages first load
  and whenever a new message (not the viewer's own) arrives live while
  that conversation is the open one — so staying in a channel while
  messages come in keeps it marked current, not just the moment it was
  opened. The unread check itself excludes the viewer's own messages and
  anything soft-deleted, and deliberately isn't `SECURITY DEFINER`: it
  runs with the caller's own RLS applied to `messages` directly, so it
  can only ever see what that user could already see through the normal
  policies, with no separate visibility logic to keep in sync.

  New signups get auto-welcomed into `#general` by a bot (`0012_welcome_bot.sql`).
  Rather than create a fake `auth.users` row just to have something to
  post as, `messages.sender_id` became nullable — `null` means a
  system/bot post, handled throughout `CommunicationsApp.tsx` (a `BOT_NAME`
  constant, "🤖 paidcoaching.com BOT" instead of an `@username`, no
  profile lookup attempted) rather than treated as a missing/unknown
  sender. The `handle_new_profile_welcome` trigger (`AFTER INSERT on
  profiles`, alongside the existing DM-creation one from 0009) finds or
  creates `#general` and posts "👋 Everyone, please welcome
  @&lt;username&gt; to the team!" — find-or-create is race-safe because
  channel names are now unique (a new `conversations_channel_name_unique`
  partial index), which also means the admin's own "+ New Channel" form
  needed a duplicate-name error message it never had before (a
  `channelError` state shown right by that form, not reusing the
  composer's `error` state, since a mistake in the sidebar showing up
  down in the message composer would be a confusing place to look for
  it). This surfaced a real bug in `has_unread_communications()`
  (0011): it checked `sender_id <> auth.uid()`, and in SQL `NULL <>`
  anything evaluates to `NULL`, not true — so a bot message would
  silently never count as unread and the dashboard's green badge would
  never notice a welcome message. 0012 re-defines the function with
  `sender_id is null or sender_id <> auth.uid()`.

  A real bug shipped with message delete and was fixed shortly after:
  `handleDeleteMessage` only checked for an `error` from the `.update()`
  call, but Supabase/Postgres don't treat "the UPDATE's RLS `USING`
  clause matched zero rows" as an error — it's just a successful update
  of nothing. Without `.select("id")` chained on afterward (so an empty
  result is distinguishable from a real success), a silently-rejected
  delete would still look like it worked in that one browser, courtesy
  of the optimistic local update, while nothing was actually written —
  a refresh, or any other session, would still show the message. The
  delete button's hover-only visibility was removed at the same time as
  a second, independent contributor (doesn't work on touch devices at
  all, and hover-based reveal on a list item is a more failure-prone
  pattern than it looks).

  Per-channel **admin-only posting** (`0013_channel_lock.sql`) is a
  toggle in the channel header, on the opposite side from the channel
  name (`justify-between` on that row) — an interactive pill button for
  admins ("Anyone can post" / "Admins only", with a lock icon), a
  static read-only badge for everyone else ("View only", shown only
  when actually restricted so it doesn't clutter every open channel).
  This is the first UPDATE policy `conversations` has ever had (nothing
  before this needed one), scoped to admins and channels only — DMs
  aren't toggleable, the button and badge simply never render for
  `type = 'dm'`. The messages INSERT policy from 0009 gets replaced
  (not just added to) to fold in the check: a channel rejects a post
  from anyone but an admin while `admin_only_posting` is true; DMs and
  unlocked channels are unaffected either way. `handleToggleChannelLock`
  follows the same optimistic-update-then-verify-a-row-came-back pattern
  `handleDeleteMessage` was fixed to use, for the same reason. A second
  realtime subscription (`UPDATE` on `conversations`, alongside the
  existing `INSERT` one for new channels appearing) is what makes a
  lock/unlock show up live for everyone already looking at that channel,
  not just after a reload — and it's also what silently disables that
  same user's composer, since `canPost` is derived from the live
  `conversations` state on every render rather than checked only once.

  **Deleting a channel** (`0019_delete_channels.sql`) is a trash icon
  next to the lock toggle, admin-only, channel-only (same `type =
  'channel'` restriction as the lock toggle — DMs were never deletable
  and still aren't). Asks for confirmation first (`window.confirm`,
  same as the destructive SOP deletes) since it takes every message,
  reaction, and read-receipt in that channel with it — all three
  already cascade-delete off `conversations.id` via their foreign keys,
  so the app only ever deletes the one `conversations` row and the
  database handles the rest. The realtime `DELETE` subscription on
  `conversations` deliberately has **no** `filter` (unlike the sibling
  `INSERT`/`UPDATE` ones, both filtered to `type=eq.channel`) — a
  `DELETE` payload's `old` record only carries the primary key under
  this table's default replica identity, so a `type`-based filter would
  never match anything and the event would silently never fire. Leaving
  it unfiltered is still safe: the delete RLS policy only ever allows
  `type = 'channel'` rows to be deleted in the first place, so any
  `DELETE` event reaching the client is a channel by construction.
  Whoever's looking at a channel when it's deleted (including other
  people's open tabs, not just whoever clicked delete) gets bounced to
  the "Pick a channel to get started" empty state immediately.

  **Reactions and message editing** (`0014_reactions_and_edit.sql`) both
  render as small icon buttons next to the trash icon on the right of
  each message. A react button (always visible on any non-deleted
  message) opens an inline emoji picker — `EmojiPicker`, a self-contained
  component in `CommunicationsApp.tsx` reading from a new
  `src/app/dashboard/communications/emoji-data.ts` (nine category tabs,
  several hundred hand-picked standard Unicode emoji, plus a search box
  matching against a hand-curated keyword map for the couple hundred
  most commonly reached-for ones — not literally the entire Unicode
  emoji registry, which runs to thousands of skin-tone/gender/hair
  variants and isn't practical to hand-maintain, but broad enough to
  cover real usage). It renders inline directly under the message
  rather than as a floating/portaled popover, trading "pushes later
  messages down while open" for not needing any viewport-aware
  positioning logic. Picking an emoji toggles it (reacting again with
  the same emoji removes it) via `message_reactions`, a table that
  denormalizes `conversation_id` off `messages` purely so its own
  realtime subscription can filter by conversation the same way
  `messages`' own subscription already does, rather than every client
  receiving every reaction change anywhere. Existing reactions render as
  small pill buttons (emoji + count, highlighted if the viewer is among
  the reactors) below the message body.

  Message editing (a pencil icon, sender-only — never an admin, since
  rewriting someone else's words is a fundamentally different capability
  than removing them, unlike delete) turns the body into an inline
  textarea with Save/Cancel. This meant partially undoing the delete
  feature's own safety trigger from 0010, which flatly forbade `body`
  from ever changing at all (that constraint is exactly what made soft
  delete "safe" to add in the first place) — 0014 replaces it with a
  trigger that allows `body` to change, but only when `old.sender_id =
  auth.uid()` and the message isn't already deleted, auto-stamping
  `edited_at` when it does. This has to be a trigger rather than an RLS
  check because the rule depends on comparing old vs. new values
  together (specifically: did `body` change, and if so is the *toggling
  user* the *original sender*) — RLS alone still only gates "can this
  user touch this row at all" (sender or admin, unchanged from 0010),
  while the trigger enforces the finer "what exactly are they allowed to
  change and under what conditions". An edited message shows "(edited)"
  next to its timestamp.

  Both features follow the same optimistic-update-then-verify-a-row-
  came-back pattern established for delete and the channel lock, for the
  same reason (Supabase doesn't treat an RLS-filtered zero-row write as
  an error).

  Verified via a standalone Puppeteer check of just `EmojiPicker` in
  isolation (temporarily exported, rendered on a throwaway route added
  to `PUBLIC_PATHS` for the run and fully reverted after — the same
  pattern used for local-only testing throughout this app's build):
  confirmed all nine categories render and are clickable without
  errors, confirmed search narrows correctly (typing "fire" returns
  exactly 🔥) and shows "No matches." for a query with none, and
  confirmed picking an emoji fires the callback with the right
  character. The reactions/edit data flow itself (inserts, updates,
  realtime) wasn't separately fetch-mocked, for the same reason
  Communications' data layer never has been — direct Supabase calls
  plus WebSocket subscriptions aren't practically mockable the way a
  handful of REST endpoints are.

- **Profiles** (`0015_profiles.sql`, `src/components/ProfileModal.tsx`).
  A button showing your own pfp (or a letter-placeholder, matching the
  fallback used everywhere else avatars render) and `@username` sits
  next to "Submit a Bug" in the dashboard header
  (`src/app/dashboard/page.tsx`) — `ProfileButton` is a self-contained
  button+modal pair mirroring `BugReportButton`'s own shape, seeded from
  a server-fetched `username`/`avatar_path` so it renders correctly on
  first paint, and kept in sync afterward via an `onProfileChange`
  callback `ProfileModal` fires after every successful avatar/profile
  save (no page reload needed to see your own edits reflected in the
  button). Clicking it opens `ProfileModal` in edit mode for your own
  account: change your avatar (uploads to the `avatars` Storage bucket
  under `<your user id>/...`, best-effort deletes the previous file,
  writes the new `avatar_path` onto `profiles`), username, bio, and
  Instagram/YouTube links. The same `ProfileModal` component also
  renders read-only — clicking any username or avatar next to a message
  in Communications (`CommunicationsApp.tsx`) opens it in view mode for
  that sender instead (`isOwn = userId === viewerId` switches which
  half of the JSX renders, rather than duplicating the avatar/loading
  scaffolding across two components). An admin's (one-letter username)
  name renders in the same gold used elsewhere in Communications; bot
  messages (`sender_id is null`) aren't clickable, since there's no
  profile to view.

  Saving a username reuses the same 23505-unique-violation handling
  pattern as everywhere else usernames are set, surfaced as "That
  username is taken." rather than a raw Postgres error. Every write
  (avatar upload, profile save) follows the same
  optimistic-update-then-verify-a-row-came-back pattern used throughout
  Communications, for the same reason.

  Verified via `npx eslint .` and a clean `rm -rf .next && npm run
  build` (the initial build caught a real issue: the installed
  `lucide-react` version has dropped all brand icons, so `Instagram`/
  `Youtube` don't exist as exports — swapped for the generic `AtSign`/
  `Video` icons instead). A full Puppeteer pass against live data
  wasn't possible in this session since it required running
  `0015_profiles.sql` against Supabase first (the `profiles` table
  doesn't have the new columns until then) — verified instead by code
  review, ESLint, and the TypeScript build, same limitation as the rest
  of Communications' direct-Supabase data flows.

- `src/app/dashboard/student-data` — **Student Data**, an admin-only
  dashboard card (`adminOnly: true` on its entry in `src/lib/cards.ts`;
  `Card.adminOnly` is a new field, filtered out of `CARDS` for anyone
  whose username isn't one letter in `dashboard/page.tsx`) listing every
  student who's joined: avatar, full name, `@username`, email, join
  date, a computed program end date (join date + 3 months, hardcoded via
  `PROGRAM_MONTHS` in `page.tsx`), and a progress bar showing how far
  into that window they are. A "View Form Submission" button per row
  opens a modal with a CMO/CEO pill switcher showing that student's
  intake answers next to each question's actual text (pulled from
  `CMO_QUESTIONS`/`CEO_QUESTIONS`), or "Not submitted yet" if they
  haven't filled it in.

  The roster comes from `admin_list_students()` (`0020_student_data.sql`,
  `SECURITY DEFINER`), which joins `profiles` with `auth.users` for
  fields RLS could never otherwise expose across accounts (email, the
  real signup timestamp) — `is_admin(auth.uid())` is checked *inside*
  the function itself, so a non-admin caller gets zero rows back rather
  than an error, and one-letter (admin) usernames are excluded from the
  result since "students" means everyone else. The page also redirects
  non-admins to `/dashboard` itself, same defense-in-depth as everywhere
  else "admin" gates a whole page in this app, not just data access.

  Verified via `npx eslint .` and a clean `rm -rf .next && npm run
  build` — the build caught two real issues: a `Date.now()` call during
  a Server Component's render body (flagged as an impure function by the
  same React Compiler purity rule that gates client components; fixed by
  switching to `new Date()`, matching the identical pattern
  `dashboard/page.tsx` already used successfully for `todayISO`) and a
  `.rpc()` call typed as implicit `any` (this project has no generated
  Supabase types, so a local `StudentRow` type was added just to type
  the `.map()` over it). A live Puppeteer pass wasn't possible without
  both a run of `0020_student_data.sql` and a real admin session with
  actual student accounts/submissions to list — verified instead via
  code review and a static HTML/Tailwind mockup of `TypeformFlow`'s
  question/done states for visual confirmation.

## Deploying

Any Next.js host works (e.g. Vercel). Set the same environment variables
there, and update `NEXT_PUBLIC_SITE_URL` plus the Supabase redirect URLs to
match the production domain.
