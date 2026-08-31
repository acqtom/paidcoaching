import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST (no body needed) -> { deals, closers, setters } for the logged-in
// portal user. Used both to load data on open and to poll for updates
// from other devices. Private per account (see
// supabase/migrations/0006_sales_board_state.sql) -- there's no
// offer/password concept anymore, the portal's own Supabase Auth session
// cookie identifies the caller.

type BoardData = { deals?: unknown[]; closers?: unknown[]; setters?: unknown[] };

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("sales_board_state")
    .select("data")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not load data." }, { status: 500 });
  }

  const data = (row?.data as BoardData) ?? {};
  return NextResponse.json({
    deals: data.deals ?? [],
    closers: data.closers ?? [],
    setters: data.setters ?? [],
  });
}
