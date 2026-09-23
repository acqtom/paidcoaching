import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSalesBoard } from "@/lib/sales-boards-state";

// GET -> { boards: [{id, name, access_code, created_at}] } -- every
// board any admin has created, not just the caller's own (see
// 0025_share_sales_boards_across_admins.sql; boards used to be scoped
// per-owner, which meant a second admin saw an empty list). Backs the
// board switcher in src/app/dashboard/sales-board/page.tsx. Admin-only,
// matching the RLS on `sales_boards`.

export async function GET() {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ("response" in admin) return admin.response;

  const { data, error } = await supabase
    .from("sales_boards")
    .select("id, name, access_code, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ boards: data ?? [] });
}

// POST { name } -> { board } -- creates a new board (empty deals/
// closers/setters, a fresh access code), recorded as created by the
// logged-in admin (`owner_id`) but immediately visible to every other
// admin too, and the database auto-creates its Metrics Tracking row
// alongside it (see the on_sales_board_created trigger).

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ("response" in admin) return admin.response;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const board = await createSalesBoard(supabase, admin.userId, name);
    return NextResponse.json({ board });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create board" },
      { status: 500 }
    );
  }
}
