import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { data } -> overwrites the logged-in account's Accounting hub
// numbers wholesale. The whole state is always sent, same full-overwrite
// contract as /api/tracking/save.

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { error } = await supabase
    .from("accounting_state")
    .upsert({ id: user.id, data: body.data, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
