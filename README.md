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
   `0021_student_payments.sql` adds `student_payments` (one row per
   student — amount paid upfront, amount due, due date, a `paid` flag),
   admin-only in both directions, backing the Payment button on Student
   Data.
   `0022_unread_per_conversation.sql` adds `unread_conversation_ids()`,
   the same query `has_unread_communications()` runs but returned per
   conversation instead of collapsed to one boolean — backs the bold
   name + green dot per unread channel/DM in the Communications sidebar.
   `0023_multi_sales_boards.sql` adds `sales_boards` and
   `metrics_tracking_boards` (lets an admin run any number of Sales Team
   Boards at once, one per offer, each auto-getting its own separate
   Metrics Tracking data via an insert trigger) plus
   `get_board_by_code`/`save_board_by_code`/`get_board_id_by_code` for
   anonymous per-board team access — entirely new tables/functions,
   parallel to the existing single-board-per-account system, which this
   doesn't touch at all.
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
  row is already private per user. "Today" for this filter is computed
  client-side inside `CashTargetCard` itself, from the viewer's own
  local calendar day (`Intl.DateTimeFormat("en-CA").format(new
  Date())`), not the server's UTC clock — the dashboard page (a Server
  Component) has no reliable notion of the viewer's timezone, and
  comparing against raw UTC caused the card to roll over hours before
  local midnight for US-based reps, making "today's" cash disappear
  early or bleed into the wrong day. The server (`dashboard/page.tsx`)
  now just fetches the raw deals from this user's own Sales Board plus
  (for admins) every extra Sales Team Board they own and hands the
  combined array straight to the card as a `deals` prop; the card does
  the date filtering and summing itself in a `useMemo`. Progress-bar color follows the same
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
  one-off gray gradient. Verified visually via a headless-Chrome
  screenshot (temporarily adding this route to `PUBLIC_PATHS` for the
  run, fully reverted after — the same pattern used throughout this app
  for auth-gated pages).

  `NewStudentForm.tsx` (the CMO tab's original placeholder — a fake
  name/email/phone/program form that never actually persisted anywhere)
  was deleted outright once the real CMO Typeform below shipped, per
  explicit direction — it was always a stand-in for exactly what that
  form now does for real. `NavigationTable.tsx` (the CEO tab's "Where
  everything lives" card-destination table) was later deleted the same
  way, per the same kind of explicit direction, once it was no longer
  wanted there — the CEO tab is now just the welcome video, Calendly
  slot, and the Business intake Typeform.

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
  verbatim) and the CEO form (2 so far, more to come later: backend
  systems in use, sales reps in place — both given verbatim too).

  `TypeformQuestion` has a third variant beyond `single_select`/
  `short_text`: **`multi_select`** — checkboxes rather than
  auto-advancing cards, since more than one can be true (the CEO form's
  first question needed this), with its own explicit Continue/Submit
  button since there's no single click that means "done." An optional
  `allowOther` flag adds a trailing "Other" checkbox that reveals a text
  input; the typed text is stored in the saved answer array in place of
  the literal word "Other", so an admin reviewing it later on Student
  Data sees what the student actually meant. A stored answer is now
  `string | string[]` (a plain string for `single_select`/`short_text`,
  an array for `multi_select`) — `SubmissionModal` in `StudentTable.tsx`
  joins arrays with `", "` for display. `MultiSelectQuestion` (alongside
  `ShortTextQuestion`) uses the same `key={question.id}`-remount pattern
  to seed its checked options and "Other" text from any previous answer
  when navigating back to it, without a `useEffect`.

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

  A follow-up request added **"Offer Made"** tracking, to separate a real
  no-close (pitched, and the prospect said no) from a call where no
  pitch even happened — per explicit direction, neither should count as
  a genuine close *or* no-close attempt for closing-effectiveness
  metrics. `dealFieldsFromForm()` computes a third field, `offerMade`,
  alongside `isCall`/`calendarStatus`: `true` for `Closed/Won/Deposit`
  (obviously a pitch happened if it closed), the answer to a new
  **"Offer made?"** yes/no question for `No Close` (`OUTCOME_FORM_CONFIG`
  — the exact same `type: "yesno"` pattern Disqualified's "Was this a
  call?" already established, right down to reusing `renderPcfField()`'s
  existing yesno branch unchanged), and `null` — deliberately not
  `false` — for every other outcome (Disqualified, No-Show, Cancelled,
  Rescheduled, Remainder Collection, 2nd CC Call Booked), so a metric
  built on `offerMade === true` cleanly *excludes* those rather than
  miscounting "doesn't apply" as an explicit no. Scoped to `No Close`
  only, per the request's own wording ("on 'no close' you can add...")
  — Disqualified and 2nd CC Call Booked are call-happened-but-not-closed
  outcomes too, but whether "offer made" applies to them at all wasn't
  asked for, so they're left out rather than guessed at; can be extended
  the same way later if wanted. The KPI grid's old single-tile "Close
  Rate" row became a 3-tile row: **Offers Made** (a plain count,
  `rows.filter(d => d.offerMade === true).length`), **Offer Made Close
  Rate** (`dealsClosed ÷ offersMade` — arguably the truer closing-skill
  number, uncontaminated by calls where no pitch happened at all), and
  the original formula relabeled **Total Close Rate** (`dealsClosed ÷
  callsOnCalendar`, unchanged) now that there are two close rates to
  tell apart. Deliberately scoped to the Sales Board's own KPI grid
  only — `offerMade` is not pushed into `metrics_tracking_state` (the
  separate historical-trend system `pushSalesBoardMetrics()` feeds,
  documented above), since that wasn't asked for and is a materially
  bigger addition (its own metric ids, its own per-date history). Old
  deals logged before this shipped have `offerMade === undefined`, which
  same as `null` is correctly excluded from Offers Made — so, same
  caveat as every other newly-added field in this file, the two new
  tiles will under-report for any date range spanning older data; there
  is no way to retroactively know whether an old No-Close deal actually
  had a pitch made. Verified live with Puppeteer end-to-end: confirmed
  the field appears only on No Close (not Closed, where it's implicit,
  and not Disqualified); that Yes/No answers save as `true`/`false`
  correctly; that Closed and Disqualified deals save `true`/`null`
  respectively with no field shown; that the edit modal correctly
  pre-fills the answer for an existing No-Close deal; and that all three
  new/relabeled KPI tiles compute the right numbers together (2 offers
  made from 4 logged calls, 1 close → 50% Offer Made Close Rate, 25%
  Total Close Rate) — plus a screenshot confirming the field's placement
  and hint text, and the new KPI row's layout, both read cleanly.

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

  Each SOP tab can now be **Text or Video** — a small pill toggle above
  the content area (switchable any time, not locked in at creation)
  swaps between the original textarea and a native **Loom** embed. Every
  tab gained `type` ("text" | "video") and `videoUrl` fields
  (`makeTabs()`/the add-form handler default new tabs to `type: "text"`;
  `normalizeSopSection()` backfills both fields — defaulting `type` to
  `"text"` — onto any tab saved before this existed, so old onboarding
  data still loads correctly). Pasting a normal Loom *share* link
  (`loom.com/share/<id>`) is enough — `loomEmbedUrl()` extracts the id
  via regex and rewrites it to the `loom.com/embed/<id>` form Loom
  requires for iframes; an already-embed URL passes through unchanged,
  and anything that doesn't look like a Loom link renders a "paste a
  link" empty state instead of a broken iframe. The URL input updates
  just its own iframe preview on every keystroke rather than re-running
  the section's full render, since rebuilding that input's DOM node
  mid-keystroke (the same class of problem the textarea's
  `preserveFocused` flag solves) would otherwise drop focus and cursor
  position while typing or pasting.

  SOP tabs within a section can also be **dragged to reorder** — native
  HTML5 drag-and-drop (`draggable="true"` on each tab, `dragstart` /
  `dragover` / `drop` / `dragend`) needing no library, since dropping tab
  A onto tab B just splices A out of `section.tabs` and re-inserts it at
  B's index. A `.dragging` class dims the tab being moved and
  `.drag-over` outlines whatever it's currently over; both clear on
  `dragend` regardless of whether the drop landed on a valid target.

  Verified live with Puppeteer against the real dev server (the two
  session/save endpoints mocked with a fake `onboarding` payload, since
  a real login session isn't available headlessly): confirmed the Video
  toggle hides the textarea and shows the URL input plus an empty state,
  that pasting `loom.com/share/<id>` renders an
  `<iframe src="https://www.loom.com/embed/<id>">`, that toggling back
  to Text preserves whatever was already typed there, and that dragging
  the third tab onto the first actually reorders the tab list
  (`['Expectations','Daily Huddles','Prep']` →
  `['Prep','Expectations','Daily Huddles']`). One cosmetic console
  warning surfaced during that pass (`allow="fullscreen"` and the legacy
  boolean `allowfullscreen` attribute both present on the same iframe) —
  fixed by dropping the redundant legacy attribute, since
  `allow="fullscreen"` alone already covers it.

  A **Directory** card sits above Main Breakdown — the first thing
  anyone sees on the Onboarding tab. Unlike the three SOP sections, it's
  a fixed set of fields, not user-addable/removable tabs: Offer name,
  Youtube, Instagram, Ads Library, Pitch Deck, VSL Landing Page,
  Confirmation Page (`DIRECTORY_FIELDS`), each a label on the left and a
  plain text input on the right for the team to drop a link (or, for
  Offer name, just the name) into. Saved as `onboarding.directory` —
  same generic jsonb merge as everything else in `onboarding`, so no SQL
  was needed. `renderDirectory()` builds its row/input DOM once
  (`container.dataset.built` guards against rebuilding it on every
  render) and on every subsequent call just refreshes each input's
  `.value` — skipping whichever one is currently focused during a poll
  re-render, the same `preserveFocused` pattern used for the SOP
  textarea and video-URL inputs, so a poll landing mid-keystroke can't
  overwrite what someone's actively typing. Verified live with
  Puppeteer against the real dev server: confirmed Directory renders
  first (`['Directory','Main Breakdown','Closer SOPs','Setter SOPs']`),
  that saved values populate their fields correctly and unsaved fields
  render blank, and that typing into a field is held correctly.

  Each of the six URL fields (every one except Offer name, which is
  `isLink: false` on its `DIRECTORY_FIELDS` entry since it's a plain
  label, not something clickable) now shows an **"Open ↗"** link next to
  its input, opening in a new tab — added after the initial version
  shipped as text-only inputs the team had to copy and paste manually.
  `directoryHref()` prefixes `https://` onto anything without its own
  scheme already (`www.instagram.com/x` → `https://www.instagram.com/x`)
  since people paste bare domains as often as full URLs, and a relative
  `<a href>` would otherwise resolve against this very page instead of
  navigating anywhere; the input itself keeps showing exactly what was
  typed, only the link's target gets normalized. The link stays hidden
  whenever that field is empty, and `updateDirectoryOpenLink()` updates
  it live on every keystroke (not just after a save completes), so
  pasting a link makes it immediately clickable. Verified live with
  Puppeteer: confirmed all six URL fields render a working, correctly-
  `https://`-prefixed `target="_blank" rel="noopener noreferrer"` link
  matching their saved value, that Offer name renders no link at all,
  that an empty field's link stays hidden, and that typing into a
  previously-empty field makes its link appear immediately with the
  right href.

  **Fixed a real data-loss bug**, reported as "the Youtube link disappeared
  right after I pasted it" and "clicking a different SOP a few seconds
  later jumps back to the one I was on" — both traced to the same root
  cause. `loadUserData()` runs on every 8-second poll
  (`setInterval(pollForUpdates, 8000)`) *and* every time the window
  regains focus (`window.addEventListener("focus", pollForUpdates)` —
  exactly what fires when someone tabs away to copy a link and switches
  back to paste it), and it unconditionally reassigned the shared
  `onboarding` variable to a fresh object built from whatever the server
  currently had. If that reassignment landed in the roughly 600ms window
  between a keystroke and its debounced save actually going out, it
  silently replaced the in-memory edit with the server's older copy —
  and the *next* debounced save then persisted that reverted state,
  permanently discarding what was just typed. Separately, switching SOP
  tabs never called `queueSaveOnboarding()` at all, so `activeId` never
  reached the server in the first place; *any* poll, race or not, would
  eventually overwrite it back to whichever tab was last actually saved
  (`normalizeSopSection()` defaults to `tabs[0]` whenever the saved
  `activeId` doesn't match).

  Fixed both: the tab-click handler now calls `queueSaveOnboarding()`
  too, and a new `onboardingSavePending` flag (set the instant an edit
  queues a save, cleared only once that save actually finishes) guards
  the reassignment in `loadUserData()` — while a save is pending or in
  flight, a poll updates deals/closers/setters/accessCode as before but
  leaves `onboarding` alone, so an in-progress edit can never be
  clobbered by a poll that just hasn't caught up yet. Verified by
  reproducing the exact race with Puppeteer against the real dev server
  (a mocked `/session` endpoint that always returns stale server data,
  with a manual `window.dispatchEvent(new Event("focus"))` timed to land
  inside that 600ms window): confirmed the bug reproduced exactly as
  reported on the pre-fix code (active tab reverted, the pasted Youtube
  link came back empty, and the *next* save persisted that emptied
  value), and that all four assertions passed once the fix was restored.

  A sixth nav tab, **Daily Huddles** (`view-huddles`), is a fixed daily
  worksheet — not a per-day history; the team clears/edits it themselves,
  same "just a persistent document" model as Onboarding, deliberately not
  an automatic-reset-at-midnight system (which would need its own
  timezone handling, exactly the bug class already fixed twice this
  session for Today's Cash Collected and the Sales Board's localStorage
  cache key). Five cards, styled with the same grey `.card` theme as
  everywhere else in the app rather than the blue/yellow spreadsheet
  look of the source template it was modeled on:

  **Daily Team Meeting**, added after the initial version shipped, is
  the first card on the page — a link field (`huddles.meetingLink`) with
  an **Open ↗** next to it, same `directoryHref()`/live-update-on-every-
  keystroke pattern as Directory's link fields (bare domains get
  `https://` prefixed for the link's target without touching what's
  actually typed, and the link stays hidden while the field's empty).
  Unlike Directory's fields, there's no separate label row — the card's
  own header already says what it is — so `renderMeetingLink()` wires a
  handful of static elements directly rather than building rows from a
  fields array. A native `<input type="time">` and a time zone
  `<select>` (`huddles.meetingTime`/`meetingTimezone`) sit to the left
  of the link, added in a follow-up request so the team knows exactly
  when and where to join, not just where. The time zone picker is a
  second, independent copy of the exact picker already proven in
  `daily-kill-list-app/app.js` — full IANA list via
  `Intl.supportedValuesOf("timeZone")` where supported (with the same
  30-zone `MEETING_TZ_FALLBACK` list for older browsers), sorted west-to-
  east by current UTC offset via the same `GMT±HH:MM`-parsing
  `tzOffsetMinutes()`/`tzOffsetLabel()` pair, and starring whichever zone
  matches the viewer's own device (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
  so it's easy to spot without being pre-selected over whatever's
  actually saved. Not shared code with daily-kill-list-app — these are
  independent static files with no module system between them, so it's
  a deliberate, small, self-contained duplication rather than a new
  cross-file dependency. Verified live with Puppeteer: confirmed the
  three fields render left-to-right in the requested order (time, time
  zone, link), that the time zone `<select>` populates with 400+ real
  IANA zones, that setting a time and zone round-trips correctly into
  the next save, that a poll racing a live edit doesn't disturb the time
  field mid-change, and that the link field keeps working unaffected
  alongside the two new ones. A screenshot confirmed the row reads
  cleanly (`09:00 AM` / `GMT-4 New York` / the pasted link / Open).

  **Fixed a severe data-loss bug found right after shipping this card**,
  reported as "it doesn't save, it deletes after a few seconds." The
  meeting link itself was never the real problem — every one of the four
  server routes that save Sales Board data
  (`/api/sales-board/save`, `/api/sales-boards/save`, and the
  `/api/sales-board(s)/by-code` pair) had been written, back when
  `onboarding` was the only opaque JSON blob living alongside
  `deals`/`closers`/`setters`, to **rebuild the entire `data` column from
  a fixed, explicitly-named set of fields** (`sales-board(s)/save`) or a
  **field whitelist** (the by-code pair) — and `huddles` was never added
  to either when Daily Huddles shipped. The two `/save` routes don't
  merge at the database level at all; they read the existing row,
  construct a brand-new object naming only the fields they know about,
  and overwrite `data` wholesale with it — so **every single save of any
  kind, to any account, from the moment Daily Huddles shipped, silently
  erased that account's entire `huddles` object** (meeting link, form
  accountability, both bottleneck spot-checks, the whole pipeline table)
  the instant anything else was saved (logging a deal, editing
  onboarding, adding a team member — anything). This is exactly why it
  looked like "deletes after a few seconds": type the link, the 600ms
  debounce fires and saves it correctly in memory, but the *next* save
  of any kind wipes it from the database, and the poll a few seconds
  later pulls that now-`huddles`-less row back down over the local copy.
  The two session routes (`/api/sales-board(s)/session`) had the mirror-
  image bug on the read side — their response objects also hand-pick
  named fields and had never been taught about `huddles` either, so even
  after fixing the write side, a normal admin session would still never
  see saved Huddles data on the next load.

  Fixed all six spots: `SalesBoardData` (`src/lib/sales-board-state.ts`)
  gained a `huddles?: unknown` field (mirroring `onboarding`'s existing
  "opaque, client owns the shape" treatment) plus a `huddles: null`
  default in both `DEFAULT_SALES_BOARD_DATA` and `DEFAULT_BOARD_DATA`;
  both `/save` routes' hand-built `next` object now carries `huddles`
  through the same `body.huddles !== undefined ? body.huddles :
  (existing.huddles ?? null)` pattern already proven correct for
  `onboarding` in the very same object literal; both `/by-code` routes'
  patch whitelist gained the same `typeof body.huddles === "object"`
  guard already used for `onboarding`; and both `/session` routes' response
  objects now include `huddles: data.huddles ?? null`. Verified by
  extracting the exact `next`-object merge logic into an isolated script
  and asserting `huddles` both updates correctly when it's the thing
  being saved *and* survives untouched when a completely unrelated save
  (e.g. just `deals`) goes through — the second case is the one that was
  actually broken. Deliberately not re-verified with another live write
  against the real production board already used for by-code debugging
  earlier in this session, since the fix is a direct, mechanical
  extension of the already-proven-correct `onboarding` pattern in the
  same lines, with no remaining design uncertainty to justify touching
  real customer data a second time.

  **Post-Call Form Accountability** rows are *derived* live from
  `CLOSERS`/`SETTERS`, not stored as their own list — only each rep's
  yes/no/blank answer is saved, keyed by name (`huddles.accountability`),
  so a rep added or removed from Add Team appears or disappears here
  automatically with zero extra bookkeeping; `renderAccountability()`
  only rebuilds the row DOM when the roster itself changes (a cheap
  joined-names signature check) so a poll doesn't drop focus on an
  untouched dropdown just because it re-ran. **Setter/Closer Bottleneck
  Spot-Check** are two instances of one generic `renderBottleneck()`
  (4 fields: a rep-in-focus dropdown populated from that role's own list
  via the existing `populateNameSelect()`, then three free-text fields —
  a fifth, "Who's accountable / by when?", was removed from
  `BOTTLENECK_FIELDS` shortly after shipping, dropping it from both
  sections and their saved data at once since they share this same
  config array) — same function, different `SETTERS`/`CLOSERS` list and
  storage key.
  **Pipeline Check (Daily Numbers)** is a table (`PIPELINE_COLUMNS`)
  starting with 10 blank rows, with its own **+ Add Row** and a per-row
  remove button; `renderPipeline()` only rebuilds the `<tbody>` when the
  actual *set* of row ids changed (a row added/removed/reordered) —
  otherwise it just refreshes each cell's value in place, skipping
  whichever one is focused, so typing in one cell survives a poll
  landing mid-keystroke without losing your place in the table. Column
  order is Rep, Prospect, Status, Deal size, Last contact, Plan (Rep
  swapped ahead of Prospect, Source dropped entirely, and Time removed
  outright — all in follow-up requests shortly after shipping); Plan is
  a `<textarea>` (`{ key: "plan", ..., type: "textarea" }` —
  `buildPipelineRowHtml()` and the same-shape refresh branch both just
  check `c.type === "textarea"` to pick the right tag, since a plain-text
  query selector like `[data-key="plan"]` matches either element
  identically) since a written forward-action plan needs more room than
  a single line; every row also got noticeably taller (bigger cell
  padding, 14px font) so the whole table reads more like a form and less
  like a cramped spreadsheet. Plan is also visibly wider than every
  other column (`{ ..., wide: true }` → a `huddle-col-wide` class →
  `width: 26%` in CSS) — the first attempt used `colspan="2"` instead,
  which looked identical in the markup but rendered *no wider than a
  normal column* once actually measured, since none of these table's
  cells have any real intrinsic content width (every one holds a
  flexible `width:100%` input/textarea), so a browser's auto table
  layout has nothing forcing a colspanned cell to actually claim two
  columns' worth of space — an explicit CSS width is a real,
  measurable hint the same auto-layout algorithm actually honors, where
  colspan alone was not.
  A **Done** checkbox column (`row.done`, a real boolean saved alongside
  the row) rounds it out — `wirePipelineRow()` special-cases
  `data-key="done"` to bind `change`/`.checked` instead of
  `input`/`.value`, in the same loop that wires every other cell.

  The card header shows a live **Total Pipeline Value** on the right —
  `parseDealSize()` strips anything but digits/`.`/`-` from each row's
  free-text Deal size field (so `"$5,000"` and `5000` both sum
  correctly) and `renderPipelineTotal()` formats the total with the
  existing `fmtUSD()` helper. It updates on every keystroke in a Deal
  size cell (called directly from that cell's own input handler, not
  just from the next full `renderPipeline()` pass) and again whenever
  the table re-renders for any other reason, so it's never stale.
  Verified live with Puppeteer: confirmed the header order, that Source
  is gone and a Done column exists, that Plan is a real `<textarea>`
  with the taller `min-height`, that checking Done round-trips into the
  next save as `done: true`, that the total starts at `$0.00` and
  updates live and correctly (`$1,500.00` after one row, `$4,000.00`
  after a second) purely from typing — no save round-trip needed — and
  that Rep/Prospect save into their correctly-swapped keys with no
  leftover `source` field. A screenshot caught nothing further wrong.

  **Marketing Check**, added in the same follow-up request, sits right
  after Post-Call Form Accountability — a general debrief on yesterday's
  prospects/lead quality, not tied to one specific rep the way the two
  Bottleneck Spot-Checks are. Its six fields (`MARKETING_FIELDS`): five
  open-ended textareas (Yesterday's Prospects Situation, Motivations,
  Struggles, Why They Didn't Move Forward, What Would Have Made Them
  Move Forward — since these read like written reflection, not short
  answers) and one plain text field (Qualification Average).

  A **Sales Process Check** — a free-form, addable checklist, not one of
  the fixed fields above — replaced an initial "Did they watch the
  pre-call assets?" yes/no question shortly after shipping, per a
  follow-up asking for the ability to name any step of the sales
  process and tick whether it happened. Each dated entry gets its own
  independent `salesProcessChecks` array (`{ id, label, done }` per
  step, `normalizeSalesProcessItem()`), typed in through a plain
  `name-add-form` (the exact same add-a-name pattern as Add Team's
  closer/setter inputs) and rendered as a checkbox + label + remove
  button per row (`renderSalesProcessCheck()`); checking one off dims
  and strikes through its label. This list rebuilds in full on every
  render — unlike a text field, a checkbox row holds no live-typed state
  a poll could interrupt mid-edit, and the add-form's own input is a
  separate, never-rebuilt element (same reasoning as Add Team's inputs),
  so there was no need for the preserveFocused treatment every other
  editable field in this app needs. Verified live with Puppeteer:
  confirmed the old yes/no field is gone; that adding, checking off, and
  removing a step all work and round-trip into the next save with the
  right `label`/`done` values; that the checked row gets the dimmed/
  struck-through styling; and that a poll racing a half-typed step name
  in the add-input doesn't touch it.

  A follow-up request changed how a new day's checklist starts: rather
  than always empty, the *steps* now carry over from whichever day was
  most recently created, so the list doesn't need retyping every
  morning — but each day still owns a fully independent copy the moment
  it's created, so editing today (renaming, adding, or removing a step,
  or just ticking one off) can never reach back and change an
  already-created day's own frozen snapshot. The "Add New Day" handler
  now copies the previous entry's `salesProcessChecks` into the new one
  with fresh ids (`makeId()` per item, so the two days' rows are never
  secretly the same object) and every `done` reset to `false` — a new
  day starts with the same checklist but nothing ticked yet. Whatever a
  day's list looks like *at the moment the next day is created* is what
  carries forward, so an edit made today does flow into tomorrow once
  tomorrow's entry actually gets created, without ever rewriting
  anything already in the past. Verified live with Puppeteer: confirmed
  a new day inherits the previous day's exact step labels, all
  unchecked; that editing the new day (removing one step, adding
  another, checking one off) leaves the earlier day completely
  untouched when switching back to it, both days' independent states
  correctly present in the next save; and that a third day, created
  after editing the second, correctly carries forward the *second* day's
  edited list rather than the first day's original one.

  A follow-up request added **"Add New Day"**, so the marketing team can
  build a history and spot patterns rather than one set of fields
  getting overwritten forever. `huddles.marketingCheck` changed shape
  from a flat field object to `{ entries: [...], activeId }` — a tab bar
  (`renderMarketingTabs()`, reusing the exact `.sop-tabs`/`.sop-tab-wrap`/
  `.sop-tab-remove` classes and per-tab "×" already established for
  Onboarding's SOP tabs, so it looks and behaves like something the team
  already knows) with one tab per day, auto-labeled from its `date` via
  the existing `fmtDayLabel()` rather than a typed name — unlike Add SOP,
  there's no name-entry step at all, so the entire class of "typed but
  not yet submitted" bug fixed for Add SOP earlier doesn't apply here:
  clicking "+ Add New Day" synchronously creates the entry, stamps it
  with `todayLocalISO()` (the browser's own local calendar day, not the
  server's UTC clock — the same fix as Today's Cash Collected, so the
  day stamped matches the day the person clicking it is actually
  having), makes it active, and queues the save, all in one handler.
  `renderMarketingCheck()` itself barely changed — it now reads/writes
  whichever entry `activeMarketingEntry()` resolves to instead of a
  single flat object, but keeps the exact same idempotent-build-once,
  refresh-values-after structure (and therefore the exact same
  poll-safety) as before. `normalizeMarketingCheck()` migrates the
  original flat shape (shipped minutes earlier, before "Add New Day"
  existed) into a single dated entry rather than discarding whatever
  might already have been typed in — the date can't be recovered for
  that entry, so it's stamped with today's date too, same as any other
  new one.

  The first version of this button had a same-day dedupe (clicking it
  again the same day would switch to that day's existing entry instead
  of creating a duplicate) — reported back almost immediately as "when I
  click Add New Day it doesn't add a new day." The migrated entry above
  is *always* dated today (it has no real original date to preserve),
  so on anyone's very first click after this shipped, the dedupe found
  that migrated entry, decided today was already covered, and just
  silently re-selected the tab already on screen — indistinguishable
  from the button doing nothing at all. Fixed by dropping the dedupe
  entirely: "+ Add New Day" now always creates a new entry, full stop,
  even if one for today already exists. A stray duplicate same-day tab
  from an accidental double-click is a trivial, visible thing to clean
  up with the existing per-tab "×"; a button that sometimes silently
  does nothing is not. Verified live with Puppeteer by reproducing the
  exact reported scenario (a migrated entry dated today, then clicking
  Add New Day twice in a row): confirmed the old flat shape migrates
  into one tab with its content intact; that the *first* click now
  correctly adds a second, genuinely blank tab (previously the bug this
  report was about); and that clicking it *again* the same day now
  correctly adds a *third* tab rather than bailing out. From the version
  before this fix: confirmed switching between days shows each one's own
  independent data (all correctly present in the next save), that
  removing a day works and switches away cleanly, and that a poll racing
  a live edit on a freshly-added day doesn't disturb it.

  **Students Due to Close Soon**, added in a follow-up request, sits
  right below Pipeline Check as its own card — a persistent (not per-day
  dated, unlike Marketing Check) table for tracking specific prospects
  who need a follow-up before they go cold: Prospect, Date to Follow Up
  (a native `<input type="date">`, the first date picker in this table —
  every other free-text table column in this app takes whatever format
  someone types), and Why They Didn't Close. Structurally it's Pipeline
  Check's exact pattern copied over (`CLOSE_SOON_COLUMNS`,
  `normalizeCloseSoonRow()`, `buildCloseSoonRowHtml()`,
  `wireCloseSoonRow()`, `renderCloseSoon()` — same idempotent same-shape
  check so typing in one cell survives a poll, same **+ Add Row**/per-row
  remove), just without Pipeline's Done checkbox or Total value, since
  neither was asked for here. The one deliberate difference from
  Pipeline: this table starts completely *empty* with a "No prospects
  added yet." message (`.huddle-table-empty`, a new class since Pipeline
  itself has no empty state — it always seeds 10 rows) rather than
  Pipeline's 10 pre-seeded blank rows, since this is a curated escalation
  list that only ever holds however many specific people actually need
  one, not a fixed daily quota to fill in. Verified live with Puppeteer:
  confirmed the card's position and header labels, that it starts empty
  with the empty-state message, that the date field is a real date
  input, that adding/filling/removing rows all round-trip correctly into
  the next save (including that removing a row removes the *right* one,
  not just any), and that a poll racing a live edit doesn't disturb it —
  plus a screenshot confirming it reads cleanly against the same grey
  card theme as everywhere else.

  **Rep Daily Numbers**, a follow-up request, is a whole new nav tab and
  page (`view-rep-numbers`) — not another card inside Daily Huddles, so
  it's its own top-level key, `repDailyNumbers`, a sibling of
  `onboarding`/`huddles` rather than living inside either. Two
  scorecards, Setter and Closer, each a table of rows *derived* live from
  `SETTERS`/`CLOSERS` — same "the roster is the source of truth, nothing
  duplicated into a separate stored name list" approach as Post-Call Form
  Accountability — with one block of metric rows per rep, seeded from a
  default list (Setter: Dials, Connections (calls answered), Bookings /
  triages, Total closes, Est commission; Closer: Calls shown, Calls
  taken, Pitches, 2nd calls booked, Closed, Est commission —
  `DEFAULT_SETTER_METRICS`/`DEFAULT_CLOSER_METRICS`) but editable/
  addable/removable per board (see below),
  the rep's name shown once per block rather than repeated down every
  row, matching the reference screenshot. `renderRepScorecard(role,
  repNames, metrics, tableId, preserveFocused)` is one generic function
  parameterized for both scorecards, same pattern as
  `renderBottleneck()`; its idempotent-build check is keyed on the
  roster's own names (`repNames.join("|")` as a signature) rather than
  row ids, since the "shape" here is which reps exist, not a
  user-addable row list like Pipeline Check.

  Each metric row has three kinds of cell: manually-typed inputs (Daily
  KPI, Mon/Tues/Wed/Thurs/Fri/Sat/Sun, Monthly Target — free text, parsed
  with the same `parseDealSize()` already used for Pipeline's Deal size,
  so `"$4,700"` and `4700` both work), and four *computed*, read-only
  cells that are never themselves stored: **Daily Pace** is the average
  of whichever Mon-Sun cells actually have something in them (not
  divided by a flat 7), so pace reflects real performance so far rather
  than being diluted by days that haven't happened yet; **Weekly Pace**
  = Daily Pace × 7; **Monthly Pace** = Weekly Pace × 4; **Weekly Target**
  = Monthly Target ÷ 4. These are exactly the formulas reverse-engineered
  from a reference spreadsheet's own numbers (dials reading `166 / 1,162
  / 4,6xx` — `166 × 7 = 1,162`, `× 4 = 4,648`; a `$4,700` monthly target
  paired with `84`/`21` daily/weekly figures). `updateRepComputedCells()`
  recomputes all four from a row's current values on every keystroke, not
  just on save, so pace updates live as numbers are typed. A per-row
  `data-currency="1"` attribute (set on Est commission's `<tr>` only) has
  `fmtPaceNumber()` prefix all four computed cells with `$`; every other
  metric's computed cells render as plain numbers.

  Wired into all four save/session/by-code routes and both `SalesBoardData`
  defaults files from the start (8 touch points total) — a new top-level
  field being missed in exactly these spots is the precise bug already
  found and fixed once this session for `huddles` (every save silently
  wiping it), so this shipped with `repDailyNumbers` in every one of
  those places from the first commit rather than as an afterthought.
  Verified live with Puppeteer: confirmed the nav tab and both tables'
  headers/rows render correctly derived from a mocked roster (rep name
  shown once per block, correct metric labels in order); that entering a
  single day's dials figure produces the *exact* reference numbers
  (`166` → `1,162` → `4,648`); that Daily Pace correctly averages
  *multiple* entered days rather than dividing by 7 (`166` and `160` →
  `163`, not `46.6`); that Weekly Target correctly derives from Monthly
  Target (`84` → `21`); that Est commission's computed cells show a `$`
  prefix while every other metric's don't; that a full edit round-trips
  correctly into the next save under the right rep/metric keys; and that
  a poll racing a live edit doesn't disturb it — plus a screenshot
  confirming the whole page reads cleanly against the reference layout.

  **Fixed a real cramping problem reported right after shipping**: every
  view in this app shares one `.app` wrapper capped at
  `max-width: 1400px` and centered, which works fine for every other
  page's content but squeezed this one 15-column table into tiny,
  hard-to-read cells with barely any room to breathe. Rather than widen
  `.app` globally (which would have affected every other view's layout
  too, unasked for), the view-tab click handler now toggles an
  `app-wide` class on `.app` on/off exactly when switching into or out
  of Rep Daily Numbers — `.app.app-wide { max-width: none; }` lets just
  this one view use the full browser width, while every other page
  keeps its normal centered 1400px column. The table itself also got
  noticeably roomier cells (14px font, ~13px cell padding, 82px-wide day
  inputs, a 210px-minimum Metric column) to match. Verified live with
  Puppeteer at a realistic 1920px desktop viewport: confirmed the
  Dashboard view's width stays capped at 1400px, that Rep Daily Numbers'
  width expands to the full 1920px viewport, that the page needs
  *neither* outer horizontal scroll *nor* the table's own inner
  `overflow-x` scroll to see every column, and that switching back to
  Dashboard correctly reverts `.app` to its normal capped width rather
  than getting stuck wide — plus a full screenshot at that viewport
  confirming it now reads as a proper full-width scorecard rather than
  a cramped little card.

  **Metrics became editable/addable per board**, plus the Daily KPI
  column got bold/gold styling, both from the same follow-up request.
  Each scorecard's metric list (`repDailyNumbers.setterMetrics`/
  `closerMetrics`) moved from a hardcoded constant to normal saved state
  — `normalizeRepMetric()`/`normalizeRepMetricsList()` shape each entry
  as `{ id, label, isCurrency }`, falling back to the
  `DEFAULT_SETTER_METRICS`/`DEFAULT_CLOSER_METRICS` list (still keyed by
  the original hardcoded strings like `dials`/`estCommission` as their
  `id`, not fresh generated ids) whenever a board has no metrics saved
  yet, so every already-saved per-rep number keeps resolving under the
  same key it always did. A small pill-list UI (`renderMetricsManager()`)
  sits above each scorecard's table: one pill per metric with an inline
  label input, a `$` checkbox to mark it as a currency metric (drives the
  existing `data-currency="1"` prefixing already built for Est
  commission), and a remove button, plus an add-metric form below the
  list. `buildRepBlockHtml()` now keys each row's `data-metric` off
  `metric.id` instead of a hardcoded key. `renderRepScorecard()`'s
  idempotent-build signature now covers *both* the roster and the
  metrics list's ids together, so adding or removing a metric correctly
  triggers a full table rebuild while a pure label rename or `$` toggle
  does not; those non-shape-changing edits instead sync live through a
  small per-row pass on every render that looks the row's metric up by
  id and refreshes its displayed label text and `data-currency`
  attribute in place — otherwise a rename made in the pill list would
  never show up in the table without a page reload.

  The pill list's label input reuses the exact same poll-vs-edit
  protection already established for every other "type to rename
  something" flow in this file: `renderMetricsManager()`'s
  `preserveFocused` guard skips overwriting whichever pill input
  currently has focus, so a poll landing mid-rename can't revert
  half-typed text. Daily KPI inputs got a new `rep-numbers-kpi-input`
  class (`font-weight: 700; color: #b8860b; border: 1px solid #d4af37;`
  plus a pale gold `:hover`/`:focus` background) — applied only to the
  Daily KPI column, not the Mon-Sun day inputs or Monthly Target, per
  the request to make that one column stand out as the number reps
  should be hitting *today*.

  Verified live with Puppeteer (server responses stubbed via request
  interception so the test didn't need a real login or Supabase data):
  confirmed a board with old-style saved data (`dials`/`estCommission`
  keys, no `setterMetrics`/`closerMetrics` saved) still renders its
  existing numbers correctly under the default metric list; that the
  Daily KPI inputs (and only those) carry the gold styling, confirmed
  via computed `color`/`border-color`/`font-weight`; that adding a new
  metric immediately adds a matching table row; that renaming a metric
  in the pill list live-updates the table's metric-cell text without a
  rebuild, and that value survives a simulated `pollForUpdates()` call
  fired mid-rename rather than getting wiped; that checking a metric's
  `$` box sets `data-currency="1"` on its row; and that removing a
  metric drops its row and the removal round-trips into the next save
  payload — plus a full-page screenshot confirming the pill lists and
  gold KPI column read cleanly against the rest of the page.

  **Reps became addable per scorecard, and the single fixed week became
  multiple real, dated weeks**, both from a further follow-up request.
  A "+" form now sits in each scorecard's `card-header` (`rep-numbers-
  setter-add-form`/`-closer-add-form`) — typing a name and submitting
  calls the exact same `addTeamMember(role, name)` the Add Team tab's
  own forms now call too (the three forms were consolidated onto one
  function rather than duplicating the push-to-`CLOSERS`/`SETTERS`-plus-
  five-re-renders sequence a third time). This means a rep added from
  Rep Daily Numbers lands in the same roster used by Add Team, Post Call
  Form, and Pipeline/Bottleneck — there's no separate name list to drift
  out of sync — and shows up instantly as a new row in this page's own
  table. Renaming a rep was explicitly **ruled out** of this round after
  discussing it — rep names are used as keys across Post Call Form
  entries, deals, and huddles, and a same-page-only rename would silently
  orphan a rep's history everywhere else, so it was dropped rather than
  shipped half-safe.

  The single Mon-Sun row per rep only ever represented "the current
  week" implicitly; multiple weeks needed to actually exist as distinct,
  datable records. `repDailyNumbers` gained `weeks` (an array of
  `{ id, weekStart }`, `weekStart` always a Monday via
  `mondayOfLocalWeek()` — the same local-calendar-day approach as
  `todayLocalISO()`, not UTC) and `activeWeekId`, shared by both
  scorecards via one tab bar (`renderRepNumbersWeekTabs()`, id
  `rep-numbers-week-tabs`) above both cards — switching weeks re-renders
  both tables together, and "+ Add New Week" always creates the week
  right after whichever is currently latest (`addDaysISO(latest.
  weekStart, 7)`), so there's no date picker to build. This tab bar is
  the exact same pattern as Marketing Check's day tabs
  (`renderMarketingTabs()`): `.sop-tab-wrap`/`.sop-tab-btn`/`.sop-tab-
  remove`/`.sop-add-btn`, a remove button hidden via `.sop-tab-remove-
  hidden` when only one week is left (can't remove the last one), full
  rebuild on every render since tabs hold no inputs to lose focus from.

  Only the Mon-Sun day values are per-week now — `dailyKpi` and
  `monthlyTarget` stay one level up on the row itself
  (`REP_NUMBERS_STATIC_FIELDS`), since those are targets that don't
  reset every week, not weekly actuals. A row's shape is now `{ dailyKpi,
  monthlyTarget, weeks: { [weekId]: { mon, tues, ... } } }`.
  `wireRepScorecardRows()` checks `REP_NUMBERS_DAY_KEYS.includes(field)`
  to decide whether a keystroke writes into `row.weeks[activeWeekId]` or
  onto the row directly, and `updateRepComputedCells()` reads its Mon-Sun
  values from `row.weeks[repDailyNumbers.activeWeekId]` rather than the
  row itself. A row saved before this shape existed has its Mon-Sun
  values flat on the row with no `weeks` object at all —
  `normalizeRepMetricRow(raw, defaultWeekId)` detects that and migrates
  it into `defaultWeekId` (the earliest week, since that's the one week
  that existed at the time), so nothing already typed in disappears the
  first time an old board loads under this shape.

  The day columns' headers ("Mon", "Tues", etc.) were previously bare
  weekday names with no way to tell which actual week they belonged to
  once more than one existed — each header cell is now a stacked
  three-line `.rep-numbers-day-header` (month on top, weekday abbreviation,
  date below), computed per column from the active week's `weekStart` via
  `addDaysISO()`/`fmtDayHeaderParts()`. Since the header depends on
  whichever week is active, `renderRepScorecard()` now rebuilds the
  `<thead>` on every render instead of only once (cheap, and a header
  has no inputs to lose focus from) while the `<tbody>`'s idempotent
  rebuild-signature check is unchanged.

  Verified live with Puppeteer (server responses stubbed via request
  interception, same approach as above): confirmed legacy flat per-day
  data migrates correctly into the current week on first load; that the
  day headers show the correct month/weekday/date for this week's
  Monday; that "+ Add New Week" creates the following week and switching
  to it shows blank Mon-Sun inputs while Daily KPI stays populated
  (shared, not per-week); that typing into the new week and switching
  back to week one leaves week one's numbers untouched, then switching
  forward again shows what was just typed; that adding a rep via the "+"
  form on Setter Scorecard immediately adds a row to that table *and*
  shows up in the Add Team tab's roster; and that the save payload's
  `activeWeekId` and `weeks` array round-trip correctly — plus a
  full-page screenshot confirming the week tabs, add-rep controls, and
  new stacked day headers all read cleanly together.

  **The pill-list metrics manager described above was removed and
  replaced** after direct feedback that it was too much UI ("Take this
  away") — a small "+" next to the Metric column header is the entire
  add-metric surface now, and reordering happens by dragging a row
  instead of a separate list. `renderMetricsManager()`, its pill list,
  and its standalone add-metric form are gone; `repMetricAddState`
  (`{ setters: false, closers: false }`, plain in-memory UI state, not
  part of `repDailyNumbers`) tracks whether each scorecard's header
  add-form is currently open, and `repMetricHeaderHtml()`/
  `wireRepMetricHeader()` swap the Metric `<th>` between a "Metric +"
  button and an inline name input + `$` checkbox + Add button. Because
  the table header is otherwise rebuilt on every render (for the
  per-week dates above), `renderRepScorecard()` now skips that rebuild
  entirely while the add-metric input is focused — the same "leave the
  DOM alone while this specific input is focused" guard used everywhere
  else in this file, just applied to a header cell instead of a body
  row. A metric can no longer be renamed or have its `$` flag toggled
  after creation — that capability was deliberately dropped along with
  the pill list rather than rebuilt elsewhere; removing and re-adding is
  the way to fix a typo or change formatting now, which matches how
  small this feature was always meant to be.

  Reordering is drag-and-drop on the Metric cell itself
  (`buildRepBlockHtml()` gives it `draggable="true"`, a small `⋮⋮`
  handle, and a `data-metric-drag` id), wired by `wireMetricRowControls()`
  — the exact same native-HTML5-drag pattern as the SOP tabs'
  drag-to-reorder (`dragstart`/`dragover`/`drop`, a `.dragging` opacity
  and `.drag-over` inset-shadow class, no library). Since every rep's
  block repeats the same metrics in the same order, dragging any single
  rep's row reorders that metric for every rep at once — there's only
  one shared order, `repDailyNumbers.setterMetrics`/`closerMetrics`
  themselves, so `renderRepScorecard()`'s existing rebuild-signature
  (rep names + metric ids, in order) already picks up a reorder as a
  shape change with no extra work. The same cell also carries the
  remove button that used to live in the pill list.

  **Weekly Target was also switched from computed to manual, and it
  joins Monthly Target in gold** — both from the same round of feedback.
  It used to be `Monthly Target ÷ 4`, filled in automatically by
  `updateRepComputedCells()`; some weeks don't cleanly divide a month
  into quarters (a 5-week month, a target set mid-month), so it's now a
  typed field like Daily KPI and Monthly Target, added to
  `REP_NUMBERS_STATIC_FIELDS` (shared across weeks, same as Monthly
  Target, not per-week like the Mon-Sun actuals) rather than to
  `updateRepComputedCells()`'s output. Both the Weekly Target and
  Monthly Target inputs now carry the same `rep-numbers-kpi-input` gold
  class Daily KPI already had, so all three target/goal columns read as
  a visually distinct group from the plain Mon-Sun actual-entry cells.

  Verified live with Puppeteer: confirmed the old pill-list manager no
  longer renders; that clicking "+" next to Metric opens an inline
  add-metric form whose typed-but-unsubmitted text survives a simulated
  `pollForUpdates()` call; that submitting it adds a new row; that
  Weekly Target is now a real `<input>` (the old `[data-computed=
  "weeklyTarget"]` cell no longer exists) and does *not* auto-fill when
  Monthly Target is typed; that both Weekly Target and Monthly Target
  carry the gold `rep-numbers-kpi-input` class; that clicking a metric's
  `×` removes its row; and that firing synthetic `dragstart`/`dragover`/
  `drop` events on two metric cells reorders them, with the new order
  round-tripping into the next save payload — plus a full-page
  screenshot confirming the drag handles, remove buttons, header "+",
  and gold Weekly/Monthly Target columns all read cleanly together.

  **Fixed a row-alignment bug reported right after shipping the above**:
  `.rep-numbers-metric-cell`'s `display: flex` was set directly on the
  `<td>` itself, and putting `display: flex` on a table cell pulls it out
  of the table's row-height model entirely (it stops behaving like a
  `table-cell` for sizing purposes) -- so its border-bottom no longer
  lined up with the plain `<td>`s next to it in the same row, most
  visibly on the multi-line "Connections (calls answered)" row. Fixed by
  moving the flex layout off the `<td>` and onto a new inner
  `.rep-numbers-metric-row` `<div>` (`display: flex; align-items: center;
  gap: 6px`) that wraps the drag handle/label/remove button, while the
  `<td>` itself goes back to being a normal table cell with
  `vertical-align: middle`. Verified live with Puppeteer by measuring
  every cell's actual rendered bottom edge (`getBoundingClientRect()`)
  across each row and confirming they're pixel-identical, for a rep with
  five metrics of varying label length (including a wrapping one) --
  plus a screenshot matching the exact scenario from the bug report.

  **The "+" add-rep form on each scorecard's `card-header` (described
  above) was removed shortly after shipping** — direct feedback was that
  it was redundant with Add Team, which already exists for exactly this
  and is the roster's actual source of truth. Both `#rep-numbers-setter-
  add-form`/`-closer-add-form` and their submit handlers are gone, the
  two card headers went back to plain `<h2>`-only (no more
  `.rep-numbers-card-header` flex layout or `.rep-numbers-add-rep-form`
  styling, both removed), and `addTeamMember(role, name)` — the shared
  function this extracted the Add Team's own two forms onto — was kept,
  since it's a clean small helper regardless of how many callers use it.
  Reps are added exclusively through Add Team now, same as before this
  round of Rep Daily Numbers work started. Verified live with Puppeteer
  that no add-rep form or input exists anywhere on the Rep Daily Numbers
  view, that each scorecard's header is back to just its title, and that
  adding a rep through Add Team still flows through correctly to a new
  row on both scorecards.

  **Two more columns, Target % and Actual %, were added to the right of
  Monthly Target** — both automated rather than typed, after a first
  attempt at a manually-typed "Rate" name + percentage pair got
  corrected mid-build to something computed instead. **Target %** =
  Weekly Target ÷ Monthly Target × 100 (a sanity check that the week's
  target actually lines up with the month's); **Actual %** = the
  already-computed Weekly Pace ÷ Monthly Target × 100 (how this week's
  real pace compares to the month's goal). Both read `0%` rather than
  dividing by zero when Monthly Target is blank. `updateRepComputedCells()`
  gained a `fmtPercentNumber()` sibling to `fmtPaceNumber()` (same
  round-to-1-decimal behavior, always suffixed `%`, no currency
  variant — a rate is never a dollar amount even on an `Est commission`
  row) and now sets two more `[data-computed]` cells alongside the
  existing Daily/Weekly/Monthly Pace ones, recalculated on every
  keystroke the same way pace already was. Since both are computed, not
  typed, `buildRepBlockHtml()`'s last two cells are plain
  `.rep-numbers-computed` cells like the pace columns, not inputs — no
  new data actually gets stored, no `normalizeRepMetricRow()` or
  `REP_NUMBERS_STATIC_FIELDS` changes were needed, and there's nothing
  for a poll to race against. Verified live with Puppeteer: confirmed
  the header reads `...Monthly Target, Target %, Actual %`; that a blank
  Monthly Target shows `0%`/`0%` for both rather than erroring; that
  Weekly Target `200` over Monthly Target `800` shows Target % as
  exactly `25%`; and that entering `20`/`30` for Mon/Tues (Weekly Pace
  `175`) over the same `800` Monthly Target shows Actual % as `21.9%` —
  plus a screenshot confirming both columns read cleanly alongside the
  other computed pace columns.

  **Target % was reported wrong and reverted back to manual** — the
  `Weekly Target ÷ Monthly Target` formula didn't match what was
  actually wanted, so rather than guess at a different formula, `target
  Percent` was added to `REP_NUMBERS_STATIC_FIELDS` and its `<td>` went
  back to being a plain `<input data-field="targetPercent">`, the same
  fixed-across-weeks treatment as Daily KPI/Weekly Target/Monthly
  Target. `updateRepComputedCells()` no longer touches it at all. Actual
  % was left as-is (`Weekly Pace ÷ Monthly Target × 100`) pending
  confirmation that its formula is the one actually wanted. Verified
  live with Puppeteer: confirmed Target % is a real `<input>` again (the
  `[data-computed="targetPercent"]` cell no longer exists) and does
  *not* auto-fill when Weekly/Monthly Target are typed; that a typed
  Target % value persists across switching to a new week, same as the
  other static target fields; and that Actual % still computes
  correctly and independently of Target % — plus a screenshot showing
  the manual `30%` Target % next to a correctly-computed `0%` Actual %.

  **Actual % turned out to mean something entirely different than
  "vs. Monthly Target"** — asked directly what the calculation should
  be, the answer was a set of specific conversion rates between *pairs*
  of built-in metrics (e.g. Setter "Dials" row = Dials ÷ Connections,
  "Bookings" row = Dials ÷ Bookings, "Total closes" row = Bookings ÷
  Total closes; Closer "Pitches"/"2nd calls booked"/"Closed" rows are
  all Calls taken ÷ that row's own metric), with "Calls shown"/"Calls
  taken" on the Closer side both measured against "calls booked" — which
  turned out to only exist on the Setter side (its "Bookings / triages"
  metric), and since this data model has no link between a specific
  setter and a specific closer, that numerator is the *whole team's*
  Bookings, summed across every setter, not any one person's.

  This is genuinely a fixed lookup table, not a general formula —
  `REP_RATE_FORMULAS` is keyed by role then by the *built-in* metric id
  (`dials`, `bookings`, `callsShown`, etc.), each entry naming a
  numerator and denominator that's either another metric id on the same
  rep's own rows, or `{ team: "bookings" }` meaning "summed across every
  setter." A metric with no entry (Connections, Est commission, or
  anything added through the "+" form, which gets a fresh generated id
  the table can't know about) shows `--` instead of a percentage, rather
  than a misleading `0%`. `computeWeeklyPace(row)` was pulled out of
  `updateRepComputedCells()` as its own function so the same pace math
  could be reused to look up *other* rows' Weekly Pace —
  `metricWeeklyPaceFor(role, repName, metricId)` for a same-rep lookup,
  `teamWeeklyPaceSum(role, metricId)` summed across `SETTERS`/`CLOSERS`
  for the team-wide case — and `updateRepComputedCells()` now takes
  `role`/`repName` alongside `tr`/`row` so it can resolve these lookups.

  Because a single keystroke can now change a *different* row's Actual %
  (typing into Dials affects Bookings' and Total closes' rows on the
  same rep) or even a different table's (typing into any setter's
  Bookings affects every closer's Calls shown/Calls taken, through the
  team-wide sum), `wireRepScorecardRows()`'s input handler no longer
  calls `updateRepComputedCells()` for just its own row -- it calls
  `renderRepDailyNumbers(true)` instead, which refreshes both
  scorecards' computed cells in one pass (the existing `preserveFocused`
  guard keeps the input being typed into from losing focus). This is a
  broader refresh than before, but the tables are small enough that it's
  not noticeable, and it was simpler and more obviously correct than
  hand-tracking which cells any given metric change could affect.

  Verified live with Puppeteer: entered Dials `100`/`100`, Connections
  `50`, Bookings `20`, Total closes `5` for one setter and confirmed
  Actual % reads exactly `200%`/`500%`/`400%` on the Dials/Bookings/
  Total closes rows and `--` on Connections/Est commission; entered
  Calls shown `10`, Calls taken `8`, Pitches `4`, 2nd calls booked `2`,
  Closed `1` for one closer against that same team's Bookings total and
  confirmed `200%`/`250%`/`200%`/`400%`/`800%` respectively; and — the
  cross-table case — confirmed that increasing that setter's Bookings
  further changed the closer's Calls shown Actual % live, without
  touching the Closer Scorecard directly, from `200%` to `266.7%` —
  plus a screenshot of both scorecards with their rates lined up
  against the numbers that produced them.

  **Both the direction of every rate and which row it belonged on were
  backwards, plus Target % went automatic again** — reported with a
  concrete example (Connection Rate on 8 connections off 30 dials should
  read `8/30 = 26.6%`) that exposed two compounding mistakes: every rate
  had been built as *(the earlier funnel stage) ÷ (this row's own
  metric)* — e.g. Dials ÷ Connections, shown on the Dials row — when it
  should be the reciprocal, *(this row's own metric) ÷ (the earlier
  stage)*, shown on the row it's actually rating. So `dials` was dropped
  from `REP_RATE_DENOMINATORS` entirely (Dials is the top of the funnel
  -- nothing precedes it to rate it against, so it shows `--`) and every
  remaining entry became just a denominator lookup instead of a
  numerator/denominator pair, since the numerator is now always the
  row's own already-computed value: Setter `connections`/`bookings` both
  → `dials`, `totalCloses` → `bookings`; Closer `pitches`/
  `secondCallsBooked`/`closed` all → `callsTaken`, `callsShown`/
  `callsTaken` both → the team-wide `{ team: "bookings" }` sum, all
  unchanged from before since only the direction, not the pairing, was
  wrong.

  Target % also went back to automatic, now reusing this exact same
  `REP_RATE_DENOMINATORS` table rather than a new one — the same metric
  pairing, just resolved against `monthlyTarget` values
  (`metricMonthlyTargetFor()`) instead of Weekly Pace
  (`metricWeeklyPaceFor()`). `computeActualPercent()` and the never-built
  equivalent target function were collapsed into one
  `computeRatePercent(role, repName, metricId, ownValue, valueGetter)`,
  parameterized by which value-getter to use, so both columns share one
  lookup and one null-handling path (no entry → `null` → renders `--`)
  instead of duplicating the same branching logic twice. Target %'s
  `<td>` went back from a manual `<input>` to a
  `.rep-numbers-computed` cell, and `targetPercent` came back out of
  `REP_NUMBERS_STATIC_FIELDS` since nothing is typed into it anymore.

  Verified live with Puppeteer using the exact numbers from the report:
  Dials `30`, Connections `8` (single day each, so the same ×7
  weekly-pace scaling applies to both and cancels out of the ratio)
  produced Connections Actual % of `26.7%` (the correctly-rounded form
  of `8/30`); Bookings `5` and Total closes `1` cascaded to `16.7%` and
  `20%`; Dials and Est commission both showed `--`; Monthly Targets of
  Dials `100`/Connections `25`/Bookings `10` produced Target % of
  `25%`/`10%` on those rows while Total closes correctly showed `0%`
  (a rate *does* exist for it, its own Monthly Target was just left
  blank) rather than `--`; and confirmed the Target % cell is a
  computed `<td>` again, not an `<input>` — plus a screenshot showing
  the full corrected Setter Scorecard with Dials reading `--` and every
  other rate matching hand-calculated expectations.

  **Weekly Pace and Monthly Pace were also redefined** — Weekly Pace
  used to extrapolate a full week from however many days had a value
  (`Daily Pace × 7`), so logging a single close on day one already read
  "7" for the week, which didn't match the intent: log one close, read
  "on track for 1 this week, 4 this month"; log two, read "2 this week,
  8 this month." Weekly Pace is now the literal running total of
  whatever's entered so far that week (`computeWeeklyPace()` sums
  `enteredDayValuesFor(row)` instead of averaging it), and Monthly Pace
  stays `Weekly Pace × 4` unchanged — which alone produces exactly `1
  → 4` and `2 → 8`. Daily Pace was quietly *derived from* Weekly Pace
  before this (`weeklyPace / 7`), which would have silently broken once
  Weekly Pace stopped being a ×7 projection, so Daily Pace was pulled
  out into its own `computeDailyPace()` (average of entered days,
  unchanged formula) rather than continuing to piggyback on Weekly
  Pace's math. `computeWeeklyPace()` is also what Actual %'s rate
  lookups (`metricWeeklyPaceFor()`) read from, so this redefinition
  applies there too, for the same reason Target %/Actual % share one
  denominator table — "Weekly Pace" meaning two different things
  depending on which column you're looking at would be confusing; for
  every previously-verified Actual % example (all single-day entries)
  the ratio comes out identical either way, since the old ×7 canceled
  out of the division regardless.

  Verified live with Puppeteer: entering a single Closed `1` on Monday
  read `1`/`1`/`4` for Daily/Weekly/Monthly Pace; adding a second Closed
  `1` on Tuesday (2 total for the week) read `1`/`2`/`8`; a single
  `$600` Est commission entry read `$600`/`$2,400` for Weekly/Monthly
  Pace; and — confirming Weekly Pace is a real sum, not an average —
  entering `1`/`1`/`3` across Mon/Tues/Wed read Daily Pace `1.7`
  (the average) alongside Weekly Pace `5` (the sum) and Monthly Pace
  `20` (`5 × 4`), which would have been impossible under the old
  Weekly-Pace-as-Daily-Pace-×7 formula.

  Saved as a new `huddles` key alongside `onboarding` — same generic
  jsonb merge, no SQL needed — through its own parallel
  `queueSaveHuddles()`/`saveHuddles()`/`huddlesSavePending` trio,
  deliberately copying the exact `onboardingSavePending` fix above from
  the start (rather than sharing one flag between two unrelated kinds of
  data) so this brand-new feature couldn't reintroduce the very race
  just fixed. Verified live with Puppeteer against the real dev server:
  confirmed the nav tab and page heading render, that accountability
  rows exactly match a mocked closers+setters roster, that each
  bottleneck's rep dropdown only lists its own role, that the pipeline
  table starts with 10 rows and Add Row/remove-row both work (removing
  the row actually holding typed data, not just any row), that a full
  edit across all three sections round-trips correctly into the next
  save's `huddles` payload, and — reusing the same race-condition
  harness as the onboarding fix above — that a poll landing mid-keystroke
  in a bottleneck field doesn't wipe it. A visual pass caught the one
  real bug: the pipeline table's remove button rendered as an unstyled
  grey box, since `.row-delete`'s existing styling was scoped to
  `.data-table .row-delete` and this table uses a separate
  `.huddle-table` class — fixed by adding the equivalent rule scoped to
  `.huddle-table` too.

  **A third instance of the same poll-vs-edit race**, reported as "Add
  SOP sometimes randomly deletes what I'm typing in the name" — one more
  gap the `onboardingSavePending` guard didn't close, since typing a new
  SOP's not-yet-submitted name never queues a save at all (only
  submitting does), so the guard was never engaged while it mattered.
  Two compounding bugs, not one: (1) `renderSopSection()` unconditionally
  rebuilds the whole tab bar's `innerHTML` — including the "Add SOP" name
  `<input>`, which has no `value="…"` to restore since the typed text
  only ever lives in that DOM node, never in `onboarding` — on *every*
  call, poll-triggered or not, so a poll landing mid-keystroke wiped the
  input back to blank (or collapsed the form back to the "+ Add SOP"
  button outright, since `section.adding` isn't part of what
  `normalizeSopSection()` restores from the server either). (2) A deeper
  bug the first fix alone would have masked rather than solved: even
  after skipping that render, `loadUserData()` still swapped
  `onboarding[key]` for a brand-new object from the server, orphaning
  the add-form's `submit` handler, which had closed over the *old*
  `section` reference — submitting would silently push the new tab onto
  that dead, no-longer-referenced object while `rerender()` read the
  fresh one, so the tab visually appeared to never get added at all.
  Fixed both: `renderSopSection()` now returns immediately, before
  touching any DOM, whenever a poll re-render (`preserveFocused`) finds
  the add-input currently focused — leaving the half-typed name and open
  form untouched; and `loadUserData()`'s onboarding guard now also checks
  `.adding` on all three sections, freezing the whole `onboarding` object
  (the same treatment as a pending save) for as long as any "Add SOP"
  form is open anywhere, so its `section` reference can never go stale
  out from under an in-progress add. Verified by writing a Puppeteer
  test that races a poll against a half-typed, not-yet-submitted SOP
  name: confirmed it reproduced the exact reported bug against the
  pre-fix code (the input vanished entirely, form and all), confirmed
  both assertions pass with the first fix alone plus a *new* one
  (submitting afterward silently failed to add the tab — this is what
  caught bug (2)), and confirmed all three pass — input survives the
  race, and submitting afterward correctly adds the tab — once both
  fixes were in place together.

  **Links pasted into an SOP's body are now clickable.** A `<textarea>`
  can never render inline markup, so the SOP content area now works as a
  click-to-edit field: at rest it shows a read-only `sop-content-view`
  div with any `http(s)://` or `www.` link turned into a real `<a
  target="_blank" rel="noopener noreferrer">` via a new `linkifyText()`
  (built on the same `escapeHtml()`-first, only-replace-the-matched-URL
  approach as `directoryHref()`'s scheme-prefixing, plus trimming
  trailing sentence punctuation like a period or comma off the link
  itself); clicking anywhere in it *except* an actual link swaps back to
  the plain, fully-editable textarea and focuses it, and blurring the
  textarea swaps back to the freshly-linkified view. The two elements
  are just shown/hidden via each other's `hidden` attribute — same
  underlying `activeTab.content` the whole time, never a separate copy
  that could drift out of sync.

  Two things had to be gotten right for this to actually be safe: (1)
  the toggle only ever fires off real focus/blur/click events, and the
  render function only touches visibility while `document.activeElement
  !== contentEl` — so a poll landing mid-keystroke (`preserveFocused`)
  can't flip a user out of edit mode while they're typing, extending the
  exact protection the Add SOP fix above established to this new toggle
  too. (2) The Video/Loom toggle earlier in this same function sets
  `contentEl.style.display = "none"` via inline style when a tab is
  switched to Video — an inline style outranks the `hidden` attribute's
  UA stylesheet rule, so switching back to Text would otherwise leave
  the textarea permanently stuck invisible underneath a `hidden = false`
  that no longer had any visible effect; fixed by resetting
  `contentEl.style.display = ""` at the top of the Text branch, letting
  `hidden` govern visibility again. Verified live with Puppeteer:
  confirmed the view renders both links correctly (comma trimmed off
  one, `https://` added to the other, `target`/`rel` correct) while the
  textarea stays hidden; that clicking the view enters edit mode and
  focuses the textarea; that typing a new link and blurring returns to
  view mode with that link now clickable *and* correctly saved; that a
  poll racing a live edit doesn't disturb it; and — specifically to
  catch bug (2) above — that toggling a tab to Video and back to Text
  still lets the textarea actually become visible on the next
  click-to-edit, not just report `hidden: false` while remaining
  invisible underneath a stale inline style.

  **Two more SOP video bugs**, both reported together from one
  screenshot: the read-only text view stayed visible stacked on top of
  the video (the Video branch hid the textarea but never touched
  `viewEl`, the read-only linkified view added for clickable SOP links —
  fixed by explicitly hiding both `contentEl` and `viewEl`, via the
  `hidden` attribute now, not the old `style.display`, so it can't
  reintroduce the stale-inline-style class of bug above). Second, and
  more serious: playing the embedded Loom video would restart it and cut
  it off a few seconds in. `videoEl.innerHTML` was being rebuilt from
  scratch — recreating a brand-new `<iframe>` every time — on *every*
  render, and this section re-renders on every 8s poll regardless of
  what's actually on screen, so watching a Loom embedded in the active
  SOP tab meant its `<iframe>` (and the video state inside it) got torn
  down and recreated on whatever cadence the poll happened to land on.
  Fixed with an idempotent-build pattern in the same spirit as
  `renderPipeline()`'s row-shape check: the input/frame-wrap DOM is only
  built once per SOP tab (`videoEl.dataset.tabId`), and the `<iframe>`
  itself is only ever rebuilt when the video URL actually changed from
  what's currently rendered (`videoEl.dataset.renderedUrl`) — a routine
  poll re-render with nothing new to show now leaves the existing
  `<iframe>` completely untouched. Verified live with Puppeteer:
  confirmed both the view and the textarea are hidden while a tab is in
  Video mode with only the video showing, that the iframe's `src`
  correctly resolves to the embed URL; then marked the actual live
  `<iframe>` DOM node and confirmed that exact same node (not a
  same-looking replacement) survives three consecutive poll re-renders
  untouched — proving the video can no longer be restarted by the
  background sync — while confirming a genuine URL edit still correctly
  rebuilds it. A separate regression pass confirmed Text ⇄ Video
  round-tripping (including mid-edit) and click-to-edit still all work
  together correctly after this change.

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

  **Multiple boards per admin** (`0023_multi_sales_boards.sql`) — for
  running several offers at once, each with its own deals/closers/
  setters, its own team access code, and its own separate Metrics
  Tracking data. Entirely new and additive, parallel to the original
  single-board-per-account system (`sales_board_state`,
  `metrics_tracking_state`, `/api/sales-board/*`) — which stays
  completely untouched and keeps working exactly as before for every
  non-admin account. Per explicit direction, an admin's existing single-
  board data is *not* migrated into this new system; every admin starts
  with zero multi-boards, and their old board simply isn't one of these
  rows (nothing is deleted — it's just unreferenced by anything new).
  Admin-only in every direction, not just hidden in the UI: `sales_boards`
  and `metrics_tracking_boards`' RLS policies both re-check
  `is_admin(auth.uid())` themselves, so this can't be reached by a non-
  admin even by calling the new API routes directly.

  Schema: `sales_boards` (`id`, `owner_id`, `name`, `access_code`, `data`
  — the same `SalesBoardData` shape as the singleton system) and
  `metrics_tracking_boards` (`board_id` primary key referencing
  `sales_boards`, `data`, `sales_board_dates` — same shape as
  `metrics_tracking_state`). A new board's Metrics Tracking row is
  created automatically by an `after insert on sales_boards` trigger
  (`handle_new_sales_board()`) in the same transaction as the board
  itself — the "auto syncs with a new metrics tracking it auto makes"
  part — so application code never has to remember to create it
  separately. `pushSalesBoardMetrics`/`pushSalesBoardMetricsForBoard`
  (`src/lib/metrics-tracking-state.ts`) now share one `pushMetrics()`
  helper parameterized by table/key-column, rather than duplicating the
  merge-and-upsert logic for the board-scoped variant.

  New API routes, each mirroring an existing singleton-system route's
  exact request/response contract so the two ported apps
  (`public/sales-board-app/index.html`, `public/tracking-app/index.html`)
  need almost no new code, just a new branch for which endpoint to call:
  `GET`/`POST /api/sales-boards` (list/create, admin-only —
  `src/lib/sales-boards-state.ts`'s `createSalesBoard()` retries on an
  access-code collision the same way `ensureSalesBoardRow()` already
  does), `POST /api/sales-boards/session`/`save` (both `?board=<id>`,
  admin + ownership checked), `GET`/`POST /api/sales-boards/by-code`
  (anonymous, resolved through new `get_board_by_code`/
  `save_board_by_code`/`get_board_id_by_code` functions against
  `sales_boards` — entirely parallel to, and never interacting with,
  `get_sales_board_by_code`/`save_sales_board_by_code`, so a code from
  one system is never valid in the other), and
  `POST /api/metrics-boards/session`/`save` (both `?board=<id>`,
  ownership checked by joining through `sales_boards`, since
  `metrics_tracking_boards` carries no `owner_id` of its own).
  `src/lib/require-admin.ts`'s `requireAdmin()` is shared by every one
  of the session/save/list/create routes, so a non-admin gets a clean
  401/403 instead of falling through to an opaque RLS rejection further
  down.

  Both ported apps learned one new URL param apiece (kept deliberately
  minimal rather than rebuilding either app's UI): `sales-board-app`
  gained `board` (an admin viewing one of their own boards, set only by
  the React switcher below) and `board_code` (a rep reaching one
  specific board anonymously, via `/board-access/[code]` — a full mirror
  of `/sales-access/[code]`, just pointed at the new by-code endpoints
  and a `board_code` param instead of `code`); `tracking-app` gained
  `board` (plus `board_name`, so the single implicit "client" shows the
  board's name instead of `@username` when viewing one). Existing
  `code`/`user` params and every other view — including the Add Team
  tab, which already generically displays whatever `accessCode` the
  session response carries — needed no changes at all to keep working
  for both systems.

  A second real bug, found only after real multi-board use (three
  boards created, all three showing the same stuck $10,000 in Metrics
  Tracking): `tracking-app`'s local `localStorage` cache
  (`STORE_KEY = 'growth-dashboard-v4'`) was one single, unscoped key
  shared by every board. `loadStored()` reads this cache synchronously
  on boot, before the server sync's `bootServerSync()` IIFE resolves —
  so a value cached from one board (or the original single-account
  view) made every *other*, genuinely-empty board look like "this
  browser already has unsynced data," triggering the `confirm()`
  "Import this browser's existing numbers?" prompt; accepting it (or
  just the prompt reappearing on every load, since declining never
  clears the shared cache) copied that same stale value into each new
  board's own server row. Fixed by making `STORE_KEY` include `urlBoard`
  when present (`` `growth-dashboard-v4:board:${urlBoard}` ``) so each
  board's local cache is fully isolated — `urlBoard`'s declaration moved
  earlier in the file since `STORE_KEY` now depends on it existing
  first. Verified with a live headless-Chrome load of
  `tracking-app/index.html?board=...` confirming no reference error and
  that the page still rendered its title and KPI grid correctly.
  Cleaning up the three boards' already-corrupted data required a
  one-off SQL statement run directly in Supabase (not a numbered
  migration, since it's a data fix for this specific incident, not a
  schema change): resetting `metrics_tracking_boards.data` back to
  `'{}'::jsonb` for the affected rows.

  The actual "add board, switch between boards" UI is a single shared
  React component, `src/components/BoardSwitcher.tsx`, rendered above
  the iframe on both `/dashboard/sales-board` and `/dashboard/tracking`
  (each page branches on `isAdminUsername()`: admins get the switcher,
  everyone else gets the exact same plain iframe as before). It handles
  fetching the shared board list, an inline "Add board" name form, and
  remembering the last-selected board in `localStorage` under one shared
  key (so switching boards on one page carries over as the default on
  the other, since they're views onto the same underlying rows).
  Selecting a board remounts the iframe (`key={selectedBoard.id}`)
  rather than relying on a bare `src` change to force a real reload.

  Both pages originally passed it a `buildIframeSrc(board)` *function*
  prop — which crashed the page with a generic server error the moment
  it was actually requested, since a Server Component (both page files)
  can't pass a function to a Client Component (`BoardSwitcher`) at all;
  functions aren't serializable across that boundary, and Next.js
  rejects the render outright rather than silently dropping it. Neither
  ESLint nor `next build` catches this — it's a runtime-only failure
  that only surfaces once the page is actually rendered for a real
  request, which a build step never does for a dynamic route. Fixed by
  replacing the function with a plain `mode: "sales-board" | "tracking"`
  string prop (fully serializable) and moving the two URL-building
  branches inside `BoardSwitcher` itself, keyed on that string. Confirmed
  fixed with a temporary test route rendering the exact same Server
  Component → `<BoardSwitcher mode="..." .../>` pattern with no auth
  dependency (added to `PUBLIC_PATHS` for the run, fully reverted after)
  — inspecting the actual RSC payload in the response showed only plain
  strings being passed (`{"mode":"sales-board","iframeTitle":"Test",...}`),
  confirming no function ever crosses the boundary anymore.

  The dashboard's "Today's Cash Collected" card now sums today's closed-
  deal cash across *all* of an admin's boards, combined with their
  original single board's own number, rather than showing just one —
  `dashboard/page.tsx` fetches every `sales_boards` row the admin owns
  (skipped entirely for non-admins) and folds their deals in with the
  existing calculation via a small shared `sumTodayCash()` helper.

  Also verified via `npx eslint .` and a clean `rm -rf .next && npm run
  build` (all new routes/pages registered correctly, `/dashboard/sales-
  board` and `/dashboard/tracking` correctly became dynamic now that
  both do a real admin check), and confirmed `/board-access` and
  `/board-access/[code]` both serve successfully, and that both ported
  apps still serve their static HTML correctly with the new `board`/
  `board_code` params present. A full live end-to-end pass (creating a
  real board, switching between boards, a rep using a `board_code`
  link) wasn't possible without `0023_multi_sales_boards.sql` run
  against Supabase — verified instead by code review and a static
  HTML/Tailwind mockup of `BoardSwitcher`'s populated, add-form, and
  empty states.

  **Fixed a real report after this shipped**: boards were scoped to
  whichever admin created them (`owner_id = auth.uid()` in both the RLS
  policy and every route's queries), so a second one-letter-username
  admin saw a completely empty board list and "+ Add board" even though
  their account was equally admin. Per explicit direction, boards are
  now one shared pool — `0025_share_sales_boards_across_admins.sql`
  drops the `owner_id` half of the RLS check on both `sales_boards` and
  `metrics_tracking_boards`, leaving only `is_admin(auth.uid())`, and
  every route under `/api/sales-boards`/`/api/metrics-boards` (list,
  save, session) had its matching `.eq("owner_id", admin.userId)` query
  filter dropped to match. `owner_id` itself stays on the table as a
  record of who originally created each board — it's just no longer
  part of the access check. Deliberately left untouched:
  `src/app/dashboard/page.tsx`'s own `owner_id`-filtered query, which
  feeds the *personal* "Today's Cash Collected" card (each admin's own
  cash total) — a different feature that wasn't asked about, where
  summing in every other admin's boards would have silently changed
  what that number means. This migration (like `0023_multi_sales_boards
  .sql` before it) needs to be run against Supabase directly; it wasn't
  possible to verify end-to-end with two real admin accounts from here,
  so this was verified by code review — confirming every `owner_id`
  filter that gated *board access* (as opposed to the unrelated cash
  card) was removed consistently across the RLS policies and all five
  routes — plus a clean `npm run build`.

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

  That dashboard badge only ever says "something, somewhere is unread" —
  finding out *which* sidebar row within Communications also needed
  per-conversation granularity, so each channel/DM in the sidebar now
  bolds its name and shows a green dot to its left when it has something
  unread, clearing the instant that conversation is opened (or a new
  message arrives while it's already open). `unread_conversation_ids()`
  (`0022_unread_per_conversation.sql`) is `has_unread_communications()`'s
  own query shape — same NULL-safe `sender_id is null or sender_id <>
  auth.uid()` check, so a bot's welcome message still counts as unread,
  same non-`SECURITY DEFINER` reasoning — just grouped by
  `conversation_id` and returned as a table instead of collapsed to one
  boolean. `CommunicationsApp.tsx` fetches it once on mount into a local
  `unreadIds` Set, then keeps it current via a *second*, unfiltered
  realtime subscription on `messages` INSERT (`communications-unread`,
  separate from the existing per-active-conversation one) — unfiltered
  because RLS already limits what reaches this client to conversations
  it could see anyway, the same trust boundary the unread functions
  themselves lean on. `markRead()` now clears a conversation's id out of
  local `unreadIds` immediately (before its `conversation_reads` write
  even resolves), which is also what clears the bold/dot the instant a
  conversation is opened. The sidebar row reserves the dot's width with
  an `invisible` (not `hidden`) spacer when read, so a channel's name
  never shifts left/right as its unread state toggles.

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

  A **Payment** button per row (`0021_student_payments.sql`) opens a
  form for manually entering what a student paid upfront, what's still
  owed, and when that's due — one row per student in a new
  `student_payments` table, admin-write/admin-read-only (no student-
  facing read policy at all; this is internal ops data, not something
  shown anywhere in a student's own portal). The button itself doubles
  as the status indicator: it turns red (`border-rose-400 bg-rose-100`,
  the same rose/danger palette used for delete actions elsewhere in this
  app) whenever there's a due date that's today or in the past and the
  row hasn't been marked paid — `isOverdue()` in `StudentTable.tsx`,
  compared against today's date client-side. `paid` is a separate
  explicit boolean rather than inferring "resolved" from
  `amount_due = 0`, since a partial payment might never bring the
  balance to exactly zero and an admin should be able to clear the flag
  in one action (a checkbox in the same form) regardless of the exact
  amounts. Saving upserts by `user_id` (the table's primary key, so
  every student has at most one payment record) and updates that row's
  values in local state immediately — no full page reload needed to see
  the button's color/label change.

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

  **Summary cards** (`SummaryCards.tsx`) sit above the roster: total
  student revenue (all-time / last 90 days / last 30 days), total
  accounts, total users, and average time spent per day
  (`0024_student_data_summary.sql`). "Student revenue" here is
  deliberately **not** anything the coaching business charged students —
  it's the cash every student has collected running their *own*
  business through their own Sales Board (`sales_board_state.data.deals`,
  same `callOutcome === "Closed/Won/Deposit"` filter as everywhere else
  cash gets summed), combined across every student via a new
  `admin_list_student_sales_data()` function (same admin-only,
  one-letter-usernames-excluded shape as `admin_list_students()`). The
  90/30-day windows bucket each closed deal by its own `closingDate`
  against the server's current date at render time — a coarser
  three-month rolling report doesn't need the same per-viewer local-day
  precision the "Today's Cash Collected" dashboard card does. "Total
  Users" is Total Accounts plus every closer/setter name a student has
  added to their own board's team (`data.closers`/`data.setters`,
  de-duplicated per student, trimmed/case-insensitive) — summed *across*
  students rather than de-duplicated globally, since the same first name
  showing up in two different students' boards is almost always two
  different people, not one.

  **Average time spent per day** required new instrumentation that
  didn't exist anywhere in the app before: `ActivityHeartbeat.tsx` (a
  "use client" component with no props at all, so it's trivially safe to
  render straight out of a Server Component) is now mounted for every
  logged-in user via a new `src/app/dashboard/layout.tsx` wrapping the
  entire authenticated portal. Every 20 seconds, while the tab is
  actually visible (`document.visibilityState === "visible"` — a
  backgrounded tab stops crediting time), it calls
  `record_activity_heartbeat(date, seconds)`, which upserts into a new
  `activity_daily` table (one row per user per day, `active_seconds`
  incremented atomically server-side). `date` is this browser's own
  local calendar day (`Intl.DateTimeFormat("en-CA")`, the same pattern
  used to fix Today's Cash Collected), and each call is capped server-
  side at 60 seconds regardless of what the client sends, so a stale
  timer (e.g. a laptop waking from sleep) can't inflate a day's total.
  `activity_daily` has RLS enabled with **no** table policies at all —
  every read and write goes through `record_activity_heartbeat()` (which
  only ever writes `auth.uid()`'s own row) or the admin-only, `SECURITY
  DEFINER` `admin_average_daily_activity_seconds()` (average
  `active_seconds` per student per active day), so no account can read
  or inflate another's activity. Since this starts collecting from
  scratch, the card will read `< 1m` for everyone until real usage
  accumulates — there's no historical data to backfill.

  Adding a portal-wide layout made every route under `/dashboard`
  dynamic (`ƒ`) at build time instead of some being prerendered as
  static (`○`) — expected, since the layout itself does a per-request
  `supabase.auth.getUser()` call to decide whether to mount the
  heartbeat, and every one of those routes already required a live
  session via the auth middleware anyway. Verified live (not just via a
  clean build) with a temporary test route rendering `SummaryCards` and
  `ActivityHeartbeat` together with fake data — confirmed a real 200
  response with the formatted dollar amounts and duration actually
  present in the HTML, then fully reverted the test route and its
  `PUBLIC_PATHS` entry.

## Deploying

Any Next.js host works (e.g. Vercel). Set the same environment variables
there, and update `NEXT_PUBLIC_SITE_URL` plus the Supabase redirect URLs to
match the production domain.
