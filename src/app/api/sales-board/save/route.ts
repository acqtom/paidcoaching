import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { deals?, closers?, setters? } -> writes whichever fields are
// present for the logged-in portal user, leaving the rest untouched.
// Private per account -- identified from the Supabase Auth session
// cookie, no offer/password anymore.

type BoardData = { deals?: unknown[]; closers?: unknown[]; setters?: unknown[] };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const { data: existingRow } = await supabase
    .from("sales_board_state")
    .select("data")
    .eq("id", user.id)
    .maybeSingle();

  const existing = (existingRow?.data as BoardData) ?? {};
  const next: Required<BoardData> = {
    deals: body.deals !== undefined ? body.deals : (existing.deals ?? []),
    closers: body.closers !== undefined ? body.closers : (existing.closers ?? []),
    setters: body.setters !== undefined ? body.setters : (existing.setters ?? []),
  };

  const { error } = await supabase
    .from("sales_board_state")
    .upsert({ id: user.id, data: next, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: "Could not save data." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
