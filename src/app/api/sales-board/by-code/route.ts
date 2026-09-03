import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pushSalesBoardMetrics } from "@/lib/metrics-tracking-state";

// Anonymous, no-login access to a single user's Sales Team Board via their
// 5-character secret key -- the same pattern as the Weekly Content Hub's
// /api/content-hub/by-code, but its own separate key (see
// supabase/migrations/0007_sales_board_access_code.sql), so one doesn't
// grant access to the other. Both operations go through SECURITY DEFINER
// Postgres functions that look up or merge-and-overwrite exactly one row's
// data blob by access_code and return nothing else about that row -- no
// service-role key needed, and there's no way to enumerate or reach any
// row without already knowing its code.
//
// Unlike Content Hub's by-code route (which always sends the *whole*
// state), the sales board's own client only ever sends the fields that
// changed (just `deals`, or just `closers`+`setters`) -- so save merges
// the given fields into the row's existing data server-side (via jsonb's
// `||` operator inside save_sales_board_by_code) rather than replacing it.
//
// A save with `deals` in it also pushes into the same account's Metrics
// Tracking, same as the session-cookie /save route -- since this path is
// anonymous, get_sales_board_owner_id (0008_...sql) resolves the code to
// the owning user's id first. Whoever already holds a valid code has full
// read/write on that account's sales data via the RPCs above already, so
// this exposes no new capability.

const DEFAULT_STATE = {
  deals: [] as unknown[],
  closers: [] as unknown[],
  setters: [] as unknown[],
  onboarding: null as unknown,
};

function normalizeCode(raw: string | null) {
  return (raw ?? "").trim().toUpperCase();
}

export async function GET(request: Request) {
  const code = normalizeCode(new URL(request.url).searchParams.get("code"));
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sales_board_by_code", { p_code: code });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Invalid or unknown secret key" }, { status: 404 });
  }

  return NextResponse.json({ ...(data as object ?? DEFAULT_STATE), accessCode: code });
}

type SavedState = { deals?: unknown[] };

export async function POST(request: Request) {
  const code = normalizeCode(new URL(request.url).searchParams.get("code"));
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (Array.isArray(body.deals)) patch.deals = body.deals;
  if (Array.isArray(body.closers)) patch.closers = body.closers;
  if (Array.isArray(body.setters)) patch.setters = body.setters;
  if (typeof body.onboarding === "object" && body.onboarding !== null) patch.onboarding = body.onboarding;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_sales_board_by_code", {
    p_code: code,
    p_patch: patch,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Invalid or unknown secret key" }, { status: 404 });
  }

  if (patch.deals !== undefined) {
    const { data: ownerId } = await supabase.rpc("get_sales_board_owner_id", { p_code: code });
    if (ownerId) {
      await pushSalesBoardMetrics(supabase, ownerId as string, (data as SavedState).deals);
    }
  }

  return NextResponse.json({ ...(data as object ?? DEFAULT_STATE), accessCode: code });
}
