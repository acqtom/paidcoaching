import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Private per portal account -- this user's own JSON blob backing the
// Daily Kill List app's cross-device sync (see
// supabase/migrations/0018_private_daily_kill_list.sql). Mirrors the
// original app's GET -> { data } / POST -> { ok } contract so the ported
// frontend script needs no changes beyond the endpoint path.

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: "Not authenticated" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("daily_kill_list_state")
    .select("data")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: row?.data ?? null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  const { error } = await supabase
    .from("daily_kill_list_state")
    .upsert({ id: user.id, data: body, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
