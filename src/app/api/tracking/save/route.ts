import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { data } -> overwrites the logged-in portal user's Metrics
// Tracking numbers wholesale. Unlike Sales Board's partial-field saves,
// the tracking UI always keeps its complete current `data` object in
// memory (it polls for out-of-band changes, e.g. a Sales Board push, and
// merges them in locally -- see public/tracking-app/index.html), so a
// full overwrite here is safe and matches what the client already sends.

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
    .from("metrics_tracking_state")
    .upsert({ id: user.id, data: body.data, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
