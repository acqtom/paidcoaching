import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findSalesBoardUser } from "@/lib/sales-board-auth";

// POST { offer, password } -> { deals, closers, setters } for that account.
// Used both to load data on login and to poll for updates from other
// devices. Mirrors the original app's api/session.js contract exactly, now
// backed by supabase/migrations/0006_sales_board_state.sql instead of
// Upstash Redis.

type BoardData = { deals?: unknown[]; closers?: unknown[]; setters?: unknown[] };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const user = findSalesBoardUser(body.offer, body.password);
  if (!user) {
    return NextResponse.json({ error: "Incorrect offer or password." }, { status: 401 });
  }

  const supabase = await createClient();
  const key = user.offer.toLowerCase();

  const { data: row, error } = await supabase
    .from("sales_board_state")
    .select("data")
    .eq("account", key)
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
