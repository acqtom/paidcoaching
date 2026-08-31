import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findSalesBoardUser } from "@/lib/sales-board-auth";

// POST { offer, password, deals?, closers?, setters? } -> writes whichever
// of deals/closers/setters are present for that account, leaving the rest
// untouched -- mirrors the original app's api/save.js contract (there,
// each field was its own Redis key; here they share one jsonb column, so
// an unset field is preserved by merging over the existing row instead of
// simply omitting a key from the write).

type BoardData = { deals?: unknown[]; closers?: unknown[]; setters?: unknown[] };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const user = findSalesBoardUser(body.offer, body.password);
  if (!user) {
    return NextResponse.json({ error: "Incorrect offer or password." }, { status: 401 });
  }

  const supabase = await createClient();
  const key = user.offer.toLowerCase();

  const { data: existingRow } = await supabase
    .from("sales_board_state")
    .select("data")
    .eq("account", key)
    .maybeSingle();

  const existing = (existingRow?.data as BoardData) ?? {};
  const next: Required<BoardData> = {
    deals: body.deals !== undefined ? body.deals : (existing.deals ?? []),
    closers: body.closers !== undefined ? body.closers : (existing.closers ?? []),
    setters: body.setters !== undefined ? body.setters : (existing.setters ?? []),
  };

  const { error } = await supabase
    .from("sales_board_state")
    .upsert({ account: key, data: next, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: "Could not save data." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
