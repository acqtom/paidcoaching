import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureSalesBoardRow } from "@/lib/sales-board-state";

// POST (no body needed) -> { deals, closers, setters, accessCode } for the
// logged-in portal user. Used both to load data on open and to poll for
// updates from other devices. Private per account (see
// supabase/migrations/0006_sales_board_state.sql) -- there's no
// offer/password concept anymore, the portal's own Supabase Auth session
// cookie identifies the caller. Also ensures the row (and its secret
// access_code, see 0007_...sql) exists, since this always runs before any
// save.

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const row = await ensureSalesBoardRow(supabase, user.id);
    const data = row.data ?? {};
    return NextResponse.json({
      deals: data.deals ?? [],
      closers: data.closers ?? [],
      setters: data.setters ?? [],
      accessCode: row.access_code,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
