import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST (no body needed) -> { data } for the logged-in portal user's
// Metrics Tracking numbers. Private per account (see
// supabase/migrations/0008_metrics_tracking_state.sql) -- this is also
// where the Sales Team Board's Post Call Form automatically writes
// closed-call numbers, so this route is what lets that show up here.

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("metrics_tracking_state")
    .select("data")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: row?.data ?? {} });
}
