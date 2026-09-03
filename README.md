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
   below).
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
  own target system. `UrgentTasksCard` reads the shared
  `task_backlog_state` singleton and shows starred (`priority: true`)
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
  whenever a save includes `deals`. It recomputes, from scratch, that
  funnel's closing-stage numbers for every date any current deal touches
  (VSL: `cash`, `revenue_gen`, `units`, `calls_show`; Webinar:
  `total_revenue`, `deals_closed`, `calls_shown`) and writes them into
  the same user's tracking row — recomputing rather than incrementing
  means an edited or deleted deal is reflected correctly, not just
  additive, per explicit direction to have this overwrite/recompute
  rather than add on top. A `sales_board_dates` column (not a key inside
  `data` itself) separately tracks which dates this feature has actually
  written to, per funnel mode — without it, there'd be no way to tell "a
  date I previously pushed to that now has no qualifying deals" (should
  be zeroed) apart from "a date the user manually typed a number into
  under one of these same 7 metric ids, that no deal has ever touched"
  (must never be touched); every other metric a person enters by hand
  (ad spend, CPC, and so on) is never touched by this either way. The
  by-code (secret-key) save path resolves the code to its owning user's
  id via `get_sales_board_owner_id` (0008_...sql, SECURITY DEFINER) before
  pushing — safe to expose, since whoever already holds a valid code has
  full read/write on that account's sales data via the existing by-code
  RPCs anyway.

  Verified with a standalone unit test against `mergeSalesBoardMetrics`
  (25 cases: per-mode isolation on mixed VSL+Webinar days, summing
  multiple same-day deals, `calls_show`/`calls_shown` correctly excluding
  No-Show, legacy undated-funnel deals defaulting to VSL, a deleted deal's
  date zeroing out via the real `sales_board_dates` bookkeeping, and —
  the one real bug this test caught before it shipped — that a
  VSL-only date never gets a stray `total_revenue`/`deals_closed` entry
  written, and that an old manual entry under a shared metric id with no
  deal history is left completely alone) and via Puppeteer end-to-end:
  confirmed the funnel picker blocks Post Call Form submission until
  chosen, confirmed the Data table's new Funnel column and the edit
  modal's pre-fill/re-save both reflect it correctly, confirmed a
  `metrics_tracking_state` row seeded server-side renders correctly in
  Tracking's own Closing-stage table once the date range covers it, and
  confirmed the one-time import prompt and the focused-input poll guard
  both behave correctly.
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

  Unlike every other feature in this app, this one is **private per
  account** rather than shared team-wide, per the user's explicit call.
  Backed by `content_hub_state` (`supabase/migrations/0005_...sql`) — one
  JSON blob per user, RLS-gated to `auth.uid() = id` instead of the
  shared-singleton pattern everywhere else — behind `/api/content-hub/state`
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

## Deploying

Any Next.js host works (e.g. Vercel). Set the same environment variables
there, and update `NEXT_PUBLIC_SITE_URL` plus the Supabase redirect URLs to
match the production domain.
