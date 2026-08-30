import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Single shared JSON blob backing the Daily Kill List app's cross-device
// sync (see supabase/migrations/0004_daily_kill_list_state.sql). Mirrors
// the original app's GET -> { data } / POST -> { ok } contract so the
// ported frontend script needs no changes beyond the endpoint path.

export async function GET() {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("daily_kill_list_state")
    .select("data")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({ data: row?.data ?? null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  const { error } = await supabase
    .from("daily_kill_list_state")
    .upsert({ id: 1, data: body, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
