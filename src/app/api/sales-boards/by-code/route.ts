import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pushSalesBoardMetricsForBoard } from "@/lib/metrics-tracking-state";

// Anonymous, no-login access to a single board's data via its own
// 5-character secret key -- entirely parallel to
// /api/sales-board/by-code (the old single-board-per-account system,
// unchanged), just resolved through get_board_by_code/
// save_board_by_code against `sales_boards` instead
// (0023_multi_sales_boards.sql). Same SECURITY DEFINER-function
// pattern: no service-role key needed, and there's no way to reach a
// board without already knowing its code.

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
  const { data, error } = await supabase.rpc("get_board_by_code", { p_code: code });

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
  const { data, error } = await supabase.rpc("save_board_by_code", {
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
    const { data: boardId } = await supabase.rpc("get_board_id_by_code", { p_code: code });
    if (boardId) {
      await pushSalesBoardMetricsForBoard(supabase, boardId as string, (data as SavedState).deals);
    }
  }

  return NextResponse.json({ ...(data as object ?? DEFAULT_STATE), accessCode: code });
}
