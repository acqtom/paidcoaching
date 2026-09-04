import { createClient } from "@/lib/supabase/server";

export type MetricsTrackingData = Record<string, Record<string, number>>;

// Which dates this feature has actually written a value for, per funnel
// mode -- tracked separately from `data` itself (a dedicated DB column,
// not a key inside the jsonb blob) precisely so a recompute can tell "a
// date I previously pushed to, now with no qualifying deals" (zero it
// out) apart from "a date the user manually typed a number into under
// one of these same metric ids, that no deal has ever touched" (never
// touch it). Without this, both cases look identical from the `data`
// blob alone.
export type SalesBoardPushedDates = { vsl: string[]; webinar: string[] };

type Deal = {
  closingDate?: string;
  callOutcome?: string;
  cashCollected?: number | string | null;
  revenueGenerated?: number | string | null;
  funnelType?: string;
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
// never touched by this code. VSL and Webinar are entirely separate
// funnel-scoped id sets with zero overlap -- Metrics Tracking stores
// values flat as { [metricId]: { [isoDate]: number } }, no funnel
// dimension, so any id shared between VSL_METRIC_META and
// WEBINAR_METRIC_META (only close_rate/aov, historically) would have one
// funnel's number silently overwrite the other's on a mixed day. Webinar's
// close_rate/aov were renamed to close_rate_webinar/aov_webinar in
// public/tracking-app/index.html specifically to keep this list collision-
// free -- keep it that way if more metrics are ever added here.
const VSL_KEYS = [
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
const WEBINAR_KEYS = [
  "total_revenue",
  "deals_closed",
  "calls_shown",
  "calls_booked",
  "show_rate_call",
  "close_rate_webinar",
  "aov_webinar",
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

type VslBucket = {
  cash: number;
  revenue_gen: number;
  units: number;
  calls_show: number;
  calls_cal: number;
  dq_calls: number;
  depos: number;
};
type WebinarBucket = { total_revenue: number; deals_closed: number; calls_shown: number; calls_booked: number };

// Recomputes the Sales-Board-owned metric cells entirely from the current
// deals list and merges them into `existingData`. Recomputing from
// scratch on every save (rather than incrementing counters) means an
// edited or deleted deal is reflected correctly, not just additive -- per
// the user's explicit choice, this overwrites whatever a person may have
// manually typed into these specific cells for these specific dates.
// VSL and Webinar are tracked as fully separate date sets (a day with
// only a VSL call never gets a Webinar entry written, and vice versa) --
// routed purely by each deal's own funnelType, never combined -- and a
// date is only ever touched here if a *current* deal lands on it or a
// *previous push* (`previouslyPushedDates`) did -- a manual entry under
// one of these same metric ids that no deal has ever touched is never
// written to.
export function mergeSalesBoardMetrics(
  existingData: MetricsTrackingData,
  previouslyPushedDates: SalesBoardPushedDates,
  deals: Deal[]
): { data: MetricsTrackingData; pushedDates: SalesBoardPushedDates } {
  const byDateVsl: Record<string, VslBucket> = {};
  const byDateWebinar: Record<string, WebinarBucket> = {};

  for (const deal of deals) {
    const date = deal.closingDate;
    if (!date) continue;
    // Deals logged before the funnel picker existed have no funnelType --
    // default them to VSL, the mode used throughout this board's history.
    const isVsl = deal.funnelType !== "webinar";
    const isClosed = deal.callOutcome === "Closed/Won/Deposit";
    const isCallRow = wasCall(deal);
    const isShown = isCallRow && calendarStatus(deal) === "showed";
    const cash = toNumber(deal.cashCollected);
    const revenue = toNumber(deal.revenueGenerated);

    if (isVsl) {
      if (!byDateVsl[date]) {
        byDateVsl[date] = { cash: 0, revenue_gen: 0, units: 0, calls_show: 0, calls_cal: 0, dq_calls: 0, depos: 0 };
      }
      const bucket = byDateVsl[date];
      if (isClosed) {
        bucket.cash += cash;
        bucket.revenue_gen += revenue;
        bucket.units += 1;
        if (deal.paymentMethod === "Deposit") bucket.depos += 1;
      }
      if (isCallRow) bucket.calls_cal += 1;
      if (isShown) bucket.calls_show += 1;
      if (wasDisqualified(deal)) bucket.dq_calls += 1;
    } else {
      if (!byDateWebinar[date]) {
        byDateWebinar[date] = { total_revenue: 0, deals_closed: 0, calls_shown: 0, calls_booked: 0 };
      }
      const bucket = byDateWebinar[date];
      if (isClosed) {
        bucket.total_revenue += cash;
        bucket.deals_closed += 1;
      }
      if (isCallRow) bucket.calls_booked += 1;
      if (isShown) bucket.calls_shown += 1;
    }
  }

  const vslDates = new Set<string>([...Object.keys(byDateVsl), ...previouslyPushedDates.vsl]);
  const webinarDates = new Set<string>([...Object.keys(byDateWebinar), ...previouslyPushedDates.webinar]);

  const data: MetricsTrackingData = { ...existingData };
  for (const key of [...VSL_KEYS, ...WEBINAR_KEYS]) {
    data[key] = { ...(existingData[key] ?? {}) };
  }

  const emptyVsl: VslBucket = { cash: 0, revenue_gen: 0, units: 0, calls_show: 0, calls_cal: 0, dq_calls: 0, depos: 0 };
  for (const date of vslDates) {
    const b = byDateVsl[date] ?? emptyVsl;
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

  const emptyWebinar: WebinarBucket = { total_revenue: 0, deals_closed: 0, calls_shown: 0, calls_booked: 0 };
  for (const date of webinarDates) {
    const b = byDateWebinar[date] ?? emptyWebinar;
    data.total_revenue[date] = b.total_revenue;
    data.deals_closed[date] = b.deals_closed;
    data.calls_shown[date] = b.calls_shown;
    data.calls_booked[date] = b.calls_booked;
    data.show_rate_call[date] = pct(b.calls_shown, b.calls_booked);
    data.close_rate_webinar[date] = pct(b.deals_closed, b.calls_booked);
    data.aov_webinar[date] = ratio(b.total_revenue, b.deals_closed);
  }

  return { data, pushedDates: { vsl: [...vslDates], webinar: [...webinarDates] } };
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
  deals: unknown
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
    const existingDates = (row?.sales_board_dates as SalesBoardPushedDates) ?? { vsl: [], webinar: [] };
    const next = mergeSalesBoardMetrics(existingData, existingDates, deals as Deal[]);

    const { error: writeError } = await supabase.from(table).upsert({
      [keyColumn]: keyValue,
      data: next.data,
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
export async function pushSalesBoardMetrics(supabase: Supabase, userId: string, deals: unknown) {
  await pushMetrics(supabase, "metrics_tracking_state", "id", userId, deals);
}

// Same as above, but for one board in the multi-board system
// (0023_multi_sales_boards.sql) -- writes into that board's own
// metrics_tracking_boards row instead of a user-wide one, so running
// multiple offers at once never mixes their numbers together.
export async function pushSalesBoardMetricsForBoard(supabase: Supabase, boardId: string, deals: unknown) {
  await pushMetrics(supabase, "metrics_tracking_boards", "board_id", boardId, deals);
}
