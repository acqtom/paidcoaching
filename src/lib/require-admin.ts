import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUsername } from "@/lib/is-admin-username";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Shared by every multi-sales-board route (0023_multi_sales_boards.sql
// gates the same thing at the RLS layer, but a clean 401/403 here beats
// letting a non-admin's request fall through to an opaque RLS rejection
// further down). Returns the authenticated admin's user id on success,
// or a Response to return immediately otherwise.
export async function requireAdmin(supabase: Supabase): Promise<{ userId: string } | { response: NextResponse }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  if (!isAdminUsername(profile?.username ?? "")) {
    return { response: NextResponse.json({ error: "Admins only" }, { status: 403 }) };
  }

  return { userId: user.id };
}
