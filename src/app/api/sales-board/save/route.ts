import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureSalesBoardRow, SalesBoardData } from "@/lib/sales-board-state";
import { pushSalesBoardMetrics } from "@/lib/metrics-tracking-state";

// POST { deals?, closers?, setters?, dailyCashTarget? } -> writes
// whichever fields are present for the logged-in portal user, leaving
// the rest untouched. Private per account -- identified from the
// Supabase Auth session cookie, no offer/password anymore. Also used by
// the dashboard's "Today's Cash Collected" card to save its target.
//
// Whenever `deals` is part of the save, this also recomputes and pushes
// the relevant closing-stage numbers into this user's Metrics Tracking
// (see src/lib/metrics-tracking-state.ts) -- automatic, no separate step.

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    // Make sure the row (and its access_code) exists before updating it --
    // covers the edge case of a save racing ahead of this user's first load.
    const existingRow = await ensureSalesBoardRow(supabase, user.id);
    const existing = existingRow.data ?? {};
    const next: Required<SalesBoardData> = {
      deals: body.deals !== undefined ? body.deals : (existing.deals ?? []),
      closers: body.closers !== undefined ? body.closers : (existing.closers ?? []),
      setters: body.setters !== undefined ? body.setters : (existing.setters ?? []),
      dailyCashTarget:
        body.dailyCashTarget !== undefined ? body.dailyCashTarget : (existing.dailyCashTarget ?? null),
    };

    const { error } = await supabase
      .from("sales_board_state")
      .update({ data: next, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) throw new Error(error.message);

    if (body.deals !== undefined) {
      await pushSalesBoardMetrics(supabase, user.id, next.deals);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save data." },
      { status: 500 }
    );
  }
}
