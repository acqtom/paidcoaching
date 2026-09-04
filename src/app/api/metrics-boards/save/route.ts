import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";

// POST ?board=<id> { data } -> overwrites one of the logged-in admin's
// own boards' Metrics Tracking numbers wholesale -- same full-overwrite
// contract as /api/tracking/save (the tracking UI always keeps its
// complete current `data` object in memory and sends the whole thing).

export async function POST(request: Request) {
  const boardId = new URL(request.url).searchParams.get("board");
  if (!boardId) {
    return NextResponse.json({ error: "Missing board" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ("response" in admin) return admin.response;

  const body = await request.json().catch(() => ({}));
  if (typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { data: board } = await supabase
    .from("sales_boards")
    .select("id")
    .eq("id", boardId)
    .eq("owner_id", admin.userId)
    .maybeSingle();
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const { error } = await supabase
    .from("metrics_tracking_boards")
    .upsert({ board_id: boardId, data: body.data, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
