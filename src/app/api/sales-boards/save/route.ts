import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import type { SalesBoardData } from "@/lib/sales-board-state";
import { pushSalesBoardMetricsForBoard } from "@/lib/metrics-tracking-state";

// POST ?board=<id> { deals?, closers?, setters?, dailyCashTarget?,
// onboarding? } -> writes whichever fields are present into one of the
// logged-in admin's own boards, leaving the rest untouched -- same
// partial-save contract as /api/sales-board/save. Whenever `deals` is
// part of the save, this also recomputes and pushes closing-stage
// numbers into that *board's own* Metrics Tracking row
// (metrics_tracking_boards), never the account-wide one.

export async function POST(request: Request) {
  const boardId = new URL(request.url).searchParams.get("board");
  if (!boardId) {
    return NextResponse.json({ error: "Missing board" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ("response" in admin) return admin.response;

  const body = await request.json().catch(() => ({}));

  const { data: existingRow, error: readError } = await supabase
    .from("sales_boards")
    .select("data")
    .eq("id", boardId)
    .eq("owner_id", admin.userId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!existingRow) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const existing = (existingRow.data as SalesBoardData) ?? {};
  const next: Required<SalesBoardData> = {
    deals: body.deals !== undefined ? body.deals : (existing.deals ?? []),
    closers: body.closers !== undefined ? body.closers : (existing.closers ?? []),
    setters: body.setters !== undefined ? body.setters : (existing.setters ?? []),
    dailyCashTarget:
      body.dailyCashTarget !== undefined ? body.dailyCashTarget : (existing.dailyCashTarget ?? null),
    onboarding: body.onboarding !== undefined ? body.onboarding : (existing.onboarding ?? null),
  };

  const { error } = await supabase
    .from("sales_boards")
    .update({ data: next, updated_at: new Date().toISOString() })
    .eq("id", boardId)
    .eq("owner_id", admin.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.deals !== undefined) {
    await pushSalesBoardMetricsForBoard(supabase, boardId, next.deals);
  }

  return NextResponse.json({ ok: true });
}
