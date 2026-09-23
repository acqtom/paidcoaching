import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";

// POST ?board=<id> -> { data } for any board any admin has access to
// (not just the caller's own, see
// 0025_share_sales_boards_across_admins.sql)'s Metrics Tracking
// numbers -- same response contract as /api/tracking/session so
// public/tracking-app/index.html needs no changes beyond which
// endpoint it calls (see `urlBoard` there). metrics_tracking_boards
// itself only carries a board_id, so this confirms the board exists
// via `sales_boards` first.

export async function POST(request: Request) {
  const boardId = new URL(request.url).searchParams.get("board");
  if (!boardId) {
    return NextResponse.json({ error: "Missing board" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ("response" in admin) return admin.response;

  const { data: board } = await supabase
    .from("sales_boards")
    .select("id")
    .eq("id", boardId)
    .maybeSingle();
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const { data: row, error } = await supabase
    .from("metrics_tracking_boards")
    .select("data")
    .eq("board_id", boardId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: row?.data ?? {} });
}
