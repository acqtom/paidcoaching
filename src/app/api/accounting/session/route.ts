import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST (no body) -> { data } for the logged-in account's Accounting hub.
// Returns an empty object for an account that has never saved, so every
// account starts at zero (see 0026_accounting_state.sql).

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("accounting_state")
    .select("data")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: row?.data ?? {} });
}
