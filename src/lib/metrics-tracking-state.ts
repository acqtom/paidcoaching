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
};

// The 7 metric ids this feature owns -- everything else in a tracking row
// (ad spend, CPC, and every other metric a user types in by hand) is
// never touched by this code.
const VSL_KEYS = ["cash", "revenue_gen", "units", "calls_show"] as const;
const WEBINAR_KEYS = ["total_revenue", "deals_closed", "calls_shown"] as const;

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

// Recomputes the Sales-Board-owned metric cells entirely from the current
// deals list and merges them into `existingData`. Recomputing from
// scratch on every save (rather than incrementing counters) means an
// edited or deleted deal is reflected correctly, not just additive -- per
// the user's explicit choice, this overwrites whatever a person may have
// manually typed into these specific cells for these specific dates.
// VSL and Webinar are tracked as fully separate date sets (a day with
// only a VSL call never gets a Webinar entry written, and vice versa),
// and a date is only ever touched here if a *current* deal lands on it or
// a *previous push* (`previouslyPushedDates`) did -- a manual entry under
// one of these same metric ids that no deal has ever touched is never
// written to.
export function mergeSalesBoardMetrics(
  existingData: MetricsTrackingData,
  previouslyPushedDates: SalesBoardPushedDates,
  deals: Deal[]
): { data: MetricsTrackingData; pushedDates: SalesBoardPushedDates } {
  const byDateVsl: Record<string, { cash: number; revenue_gen: number; units: number; calls_show: number }> = {};
  const byDateWebinar: Record<string, { total_revenue: number; deals_closed: number; calls_shown: number }> = {};

  for (const deal of deals) {
    const date = deal.closingDate;
    if (!date) continue;
    // Deals logged before the funnel picker existed have no funnelType --
    // default them to VSL, the mode used throughout this board's history.
    const isVsl = deal.funnelType !== "webinar";
    const isClosed = deal.callOutcome === "Closed/Won/Deposit";
    const wasShown = deal.callOutcome !== "No-Show";
    const cash = toNumber(deal.cashCollected);
    const revenue = toNumber(deal.revenueGenerated);

    if (isVsl) {
      if (!byDateVsl[date]) byDateVsl[date] = { cash: 0, revenue_gen: 0, units: 0, calls_show: 0 };
      const bucket = byDateVsl[date];
      if (isClosed) {
        bucket.cash += cash;
        bucket.revenue_gen += revenue;
        bucket.units += 1;
      }
      if (wasShown) bucket.calls_show += 1;
    } else {
      if (!byDateWebinar[date]) byDateWebinar[date] = { total_revenue: 0, deals_closed: 0, calls_shown: 0 };
      const bucket = byDateWebinar[date];
      if (isClosed) {
        bucket.total_revenue += cash;
        bucket.deals_closed += 1;
      }
      if (wasShown) bucket.calls_shown += 1;
    }
  }

  const vslDates = new Set<string>([...Object.keys(byDateVsl), ...previouslyPushedDates.vsl]);
  const webinarDates = new Set<string>([...Object.keys(byDateWebinar), ...previouslyPushedDates.webinar]);

  const data: MetricsTrackingData = { ...existingData };
  for (const key of [...VSL_KEYS, ...WEBINAR_KEYS]) {
    data[key] = { ...(existingData[key] ?? {}) };
  }

  for (const date of vslDates) {
    const bucket = byDateVsl[date] ?? { cash: 0, revenue_gen: 0, units: 0, calls_show: 0 };
    data.cash[date] = bucket.cash;
    data.revenue_gen[date] = bucket.revenue_gen;
    data.units[date] = bucket.units;
    data.calls_show[date] = bucket.calls_show;
  }
  for (const date of webinarDates) {
    const bucket = byDateWebinar[date] ?? { total_revenue: 0, deals_closed: 0, calls_shown: 0 };
    data.total_revenue[date] = bucket.total_revenue;
    data.deals_closed[date] = bucket.deals_closed;
    data.calls_shown[date] = bucket.calls_shown;
  }

  return { data, pushedDates: { vsl: [...vslDates], webinar: [...webinarDates] } };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Reads this user's current metrics_tracking_state row (if any), merges
// the Sales Board's deals into it, and writes the result back. Never
// throws -- a metrics-push failure shouldn't fail the sales board save
// that triggered it, so callers just fire-and-forget this and let it log.
export async function pushSalesBoardMetrics(supabase: Supabase, userId: string, deals: unknown) {
  if (!Array.isArray(deals)) return;
  try {
    const { data: row, error: readError } = await supabase
      .from("metrics_tracking_state")
      .select("data, sales_board_dates")
      .eq("id", userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    const existingData = (row?.data as MetricsTrackingData) ?? {};
    const existingDates = (row?.sales_board_dates as SalesBoardPushedDates) ?? { vsl: [], webinar: [] };
    const next = mergeSalesBoardMetrics(existingData, existingDates, deals as Deal[]);

    const { error: writeError } = await supabase.from("metrics_tracking_state").upsert({
      id: userId,
      data: next.data,
      sales_board_dates: next.pushedDates,
      updated_at: new Date().toISOString(),
    });
    if (writeError) throw new Error(writeError.message);
  } catch (e) {
    console.error("Failed to push sales board metrics to tracking:", e);
  }
}
