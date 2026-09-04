import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";

// POST ?board=<id> -> { data } for one of the logged-in admin's own
// boards' Metrics Tracking numbers -- same response contract as
// /api/tracking/session so public/tracking-app/index.html needs no
// changes beyond which endpoint it calls (see `urlBoard` there).
// Ownership goes through `sales_boards` -- metrics_tracking_boards
// itself only carries a board_id, no owner_id of its own (same join
// 0023_multi_sales_boards.sql's RLS does).

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
    .eq("owner_id", admin.userId)
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
