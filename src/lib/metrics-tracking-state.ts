import { createClient } from "@/lib/supabase/server";

export type MetricsTrackingData = Record<string, Record<string, number>>;

// Which dates this feature has actually written a value for -- tracked separately from `data` itself (a dedicated DB column,
// not a key inside the jsonb blob) precisely so a recompute can tell "a
// date I previously pushed to, now with no qualifying deals" (zero it
// out) apart from "a date the user manually typed a number into under
// one of these same metric ids, that no deal has ever touched" (never
// touch it). Without this, both cases look identical from the `data`
// blob alone.
// Rows written before the Webinar funnel was removed may still carry a
// `webinar` list alongside `vsl`; it's ignored and dropped on next write.
export type SalesBoardPushedDates = { vsl: string[] };

type Deal = {
  closingDate?: string;
  callOutcome?: string;
  cashCollected?: number | string | null;
  revenueGenerated?: number | string | null;
  // Added later than the fields above -- a deal logged before these
  // existed has none of them, so every read below falls back to
  // deriving the same value dealFieldsFromForm() in
  // public/sales-board-app/index.html would have computed from
  // callOutcome alone, rather than silently treating legacy deals as
  // "no call happened."
  isCall?: boolean;
  calendarStatus?: string;
  disqualified?: boolean;
  paymentMethod?: string;
};

// Mirrors dealFieldsFromForm()'s own derivation exactly, for deals saved
// before a given field existed.
function wasCall(deal: Deal): boolean {
  if (deal.isCall !== undefined) return deal.isCall !== false;
  const NO_CALL_OUTCOMES = new Set(["Remainder Collection (no call)", "Cancelled", "Rescheduled", "No-Show"]);
  return !NO_CALL_OUTCOMES.has(deal.callOutcome ?? "");
}
function calendarStatus(deal: Deal): string {
  if (deal.calendarStatus) return deal.calendarStatus;
  if (deal.callOutcome === "No-Show") return "no-show";
  if (deal.callOutcome === "Cancelled") return "cancelled";
  if (deal.callOutcome === "Rescheduled") return "rescheduled";
  return "showed";
}
function wasDisqualified(deal: Deal): boolean {
  if (deal.disqualified !== undefined) return deal.disqualified;
  return deal.callOutcome === "Disqualified";
}

// The metric ids this feature owns -- everything else in a tracking row
// (ad spend, CPC, and every other metric a user types in by hand) is
// never touched by this code.
const METRIC_KEYS = [
  "cash",
  "revenue_gen",
  "units",
  "calls_show",
  "calls_cal",
  "show_rate",
  "dq_rate",
  "close_rate",
  "cash_per_call",
  "aov",
  "depos",
] as const;

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}
function pct(numerator: number, denominator: number): number {
  return denominator ? (numerator / denominator) * 100 : 0;
}
function ratio(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}

type Bucket = {
  cash: number;
  revenue_gen: number;
  units: number;
  calls_show: number;
  calls_cal: number;
  dq_calls: number;
  depos: number;
};

// Recomputes the Sales-Board-owned metric cells entirely from the current
// deals list and merges them into `existingData`. Recomputing from
// scratch on every save (rather than incrementing counters) means an
// edited or deleted deal is reflected correctly, not just additive -- per
// the user's explicit choice, this overwrites whatever a person may have
// manually typed into these specific cells for these specific dates.
// A date is only ever touched here if a *current* deal lands on it or a
// *previous push* (`previouslyPushedDates`) did -- a manual entry under
// one of these same metric ids that no deal has ever touched is never
// written to.
export function mergeSalesBoardMetrics(
  existingData: MetricsTrackingData,
  previouslyPushedDates: SalesBoardPushedDates,
  deals: Deal[]
): { data: MetricsTrackingData; pushedDates: SalesBoardPushedDates } {
  const byDate: Record<string, Bucket> = {};

  for (const deal of deals) {
    const date = deal.closingDate;
    if (!date) continue;
    const isClosed = deal.callOutcome === "Closed/Won/Deposit";
    const isCallRow = wasCall(deal);
    const isShown = isCallRow && calendarStatus(deal) === "showed";

    if (!byDate[date]) {
      byDate[date] = { cash: 0, revenue_gen: 0, units: 0, calls_show: 0, calls_cal: 0, dq_calls: 0, depos: 0 };
    }
    const bucket = byDate[date];
    if (isClosed) {
      bucket.cash += toNumber(deal.cashCollected);
      bucket.revenue_gen += toNumber(deal.revenueGenerated);
      bucket.units += 1;
      if (deal.paymentMethod === "Deposit") bucket.depos += 1;
    }
    if (isCallRow) bucket.calls_cal += 1;
    if (isShown) bucket.calls_show += 1;
    if (wasDisqualified(deal)) bucket.dq_calls += 1;
  }

  const dates = new Set<string>([...Object.keys(byDate), ...(previouslyPushedDates.vsl ?? [])]);

  const data: MetricsTrackingData = { ...existingData };
  for (const key of METRIC_KEYS) {
    data[key] = { ...(existingData[key] ?? {}) };
  }

  const empty: Bucket = { cash: 0, revenue_gen: 0, units: 0, calls_show: 0, calls_cal: 0, dq_calls: 0, depos: 0 };
  for (const date of dates) {
    const b = byDate[date] ?? empty;
    data.cash[date] = b.cash;
    data.revenue_gen[date] = b.revenue_gen;
    data.units[date] = b.units;
    data.calls_show[date] = b.calls_show;
    data.calls_cal[date] = b.calls_cal;
    data.depos[date] = b.depos;
    data.show_rate[date] = pct(b.calls_show, b.calls_cal);
    data.dq_rate[date] = pct(b.dq_calls, b.calls_show);
    data.close_rate[date] = pct(b.units, b.calls_cal);
    data.cash_per_call[date] = ratio(b.cash, b.calls_show);
    data.aov[date] = ratio(b.cash, b.units);
  }

  return { data, pushedDates: { vsl: [...dates] } };
}

// Rep Daily Numbers feed the same tracker rows the deal-based push
// writes, and win wherever they have a value: for each date and metric,
// the team's total (summed across every setter/closer on this board or
// account) replaces whatever the deals produced. A metric is only written
// for a date when somebody actually entered a number for it that day, so
// a day with only dials typed never blanks the calls-show number that
// deals put there. Clearing a rep number does not remove its tracker
// value; the last value stays until it's entered again.
const REP_DAY_KEYS = ["mon", "tues", "wed", "thurs", "fri", "sat", "sun"] as const;

type RepTotals = { dials?: number; connections?: number; bookings?: number; callsShown?: number; closed?: number };

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function repNumber(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function repTotalsByDate(rep: unknown): Record<string, RepTotals> {
  const out: Record<string, RepTotals> = {};
  if (!rep || typeof rep !== "object") return out;
  const r = rep as {
    weeks?: Array<{ id: string; weekStart: string }>;
    setters?: Record<string, Record<string, { weeks?: Record<string, Record<string, unknown>> }>>;
    closers?: Record<string, Record<string, { weeks?: Record<string, Record<string, unknown>> }>>;
  };
  const weeks = Array.isArray(r.weeks) ? r.weeks : [];
  for (const section of [r.setters ?? {}, r.closers ?? {}]) {
    for (const rep of Object.values(section)) {
      for (const [metricId, row] of Object.entries(rep ?? {})) {
        const field = (
          { dials: "dials", connections: "connections", bookings: "bookings", callsShown: "callsShown", closed: "closed" } as const
        )[metricId as keyof RepTotals];
        if (!field || !row?.weeks) continue;
        for (const week of weeks) {
          const weekRow = row.weeks[week.id];
          if (!weekRow) continue;
          REP_DAY_KEYS.forEach((dayKey, offset) => {
            const val = repNumber(weekRow[dayKey]);
            if (val === null) return;
            const date = addDaysIso(week.weekStart, offset);
            out[date] = out[date] ?? {};
            out[date][field] = (out[date][field] ?? 0) + val;
          });
        }
      }
    }
  }
  return out;
}

export function overlayRepDailyMetrics(data: MetricsTrackingData, rep: unknown): MetricsTrackingData {
  const byDate = repTotalsByDate(rep);
  const out: MetricsTrackingData = { ...data };
  const writable = (key: string) => {
    out[key] = { ...(out[key] ?? {}) };
    return out[key];
  };
  for (const [date, t] of Object.entries(byDate)) {
    if (t.dials !== undefined) writable("dials")[date] = t.dials;
    if (t.callsShown !== undefined) writable("calls_show")[date] = t.callsShown;
    if (t.closed !== undefined) writable("units")[date] = t.closed;
    if (t.bookings !== undefined) writable("rep_calls_booked")[date] = t.bookings;
    if (t.connections !== undefined && t.dials !== undefined) {
      writable("connection_rate")[date] = t.dials ? (t.connections / t.dials) * 100 : 0;
    }
  }
  return out;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Shared by both variants below -- the only difference between the
// single-board-per-account system and the multi-board one is which
// table/key column holds the metrics row, not the merge logic itself.
async function pushMetrics(
  supabase: Supabase,
  table: "metrics_tracking_state" | "metrics_tracking_boards",
  keyColumn: "id" | "board_id",
  keyValue: string,
  deals: unknown,
  repDailyNumbers: unknown
) {
  if (!Array.isArray(deals)) return;
  try {
    const { data: row, error: readError } = await supabase
      .from(table)
      .select("data, sales_board_dates")
      .eq(keyColumn, keyValue)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    const existingData = (row?.data as MetricsTrackingData) ?? {};
    const existingDates = (row?.sales_board_dates as SalesBoardPushedDates) ?? { vsl: [] };
    const next = mergeSalesBoardMetrics(existingData, existingDates, deals as Deal[]);
    const withRep = overlayRepDailyMetrics(next.data, repDailyNumbers);

    const { error: writeError } = await supabase.from(table).upsert({
      [keyColumn]: keyValue,
      data: withRep,
      sales_board_dates: next.pushedDates,
      updated_at: new Date().toISOString(),
    });
    if (writeError) throw new Error(writeError.message);
  } catch (e) {
    console.error(`Failed to push sales board metrics to ${table}:`, e);
  }
}

// Reads this user's current metrics_tracking_state row (if any), merges
// the Sales Board's deals into it, and writes the result back. Never
// throws -- a metrics-push failure shouldn't fail the sales board save
// that triggered it, so callers just fire-and-forget this and let it log.
export async function pushSalesBoardMetrics(supabase: Supabase, userId: string, deals: unknown, repDailyNumbers: unknown) {
  await pushMetrics(supabase, "metrics_tracking_state", "id", userId, deals, repDailyNumbers);
}

// Same as above, but for one board in the multi-board system
// (0023_multi_sales_boards.sql) -- writes into that board's own
// metrics_tracking_boards row instead of a user-wide one, so running
// multiple offers at once never mixes their numbers together.
export async function pushSalesBoardMetricsForBoard(supabase: Supabase, boardId: string, deals: unknown, repDailyNumbers: unknown) {
  await pushMetrics(supabase, "metrics_tracking_boards", "board_id", boardId, deals, repDailyNumbers);
}
