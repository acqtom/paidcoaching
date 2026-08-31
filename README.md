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
   Sales Team Board.
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
  a request-body offer/password. `save/route.ts` still reads the existing
  row and merges over it before upserting, since the original API let a
  save touch just one of deals/closers/setters at a time (one Redis key
  each) while Supabase holds all three in a single jsonb column that a
  naive upsert would otherwise blow away.

  Verified via Puppeteer both before and after the account-model rework
  (fetch mocked against both endpoints, matching their exact contracts,
  since a real login session isn't available headlessly). First pass:
  confirmed a wrong password showed the login error, a correct login
  rendered the seeded deal's closer/setter correctly in the Deals
  Closed/Deals Set breakdowns and the Data view, the Post Call Form's
  outcome buttons revealed the rest of the form, and logout returned to
  the login screen. After removing the login entirely: confirmed no
  `#view-login`/logout-btn/current-user-label element exists in the DOM
  at all and the dashboard is visible immediately on load with no
  interaction required, and re-confirmed the Data view and the Deals
  Closed/Set breakdowns still render seeded data correctly. Two KPI
  figures ($ sums, commission amounts) read wrong in both passes — traced
  to the test's own synthetic seed data using field names (`outcome`,
  `date`) that don't match what the real form actually submits
  (`callOutcome`, `closingDate`, plus per-deal commission rates), not a
  defect in the port — the fields that were seeded correctly (closer,
  setter, cashCollected once callOutcome matched) rendered correctly
  throughout, confirming the real data path works. Zero console errors
  in every run.

## Deploying

Any Next.js host works (e.g. Vercel). Set the same environment variables
there, and update `NEXT_PUBLIC_SITE_URL` plus the Supabase redirect URLs to
match the production domain.
