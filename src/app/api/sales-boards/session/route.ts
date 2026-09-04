import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { DEFAULT_BOARD_DATA } from "@/lib/sales-boards-state";
import type { SalesBoardData } from "@/lib/sales-board-state";

// POST ?board=<id> -> { deals, closers, setters, onboarding, accessCode }
// for one of the logged-in admin's own boards -- same response contract
// as /api/sales-board/session so public/sales-board-app/index.html
// needs no changes beyond which endpoint it calls (see `urlBoard` there).

export async function POST(request: Request) {
  const boardId = new URL(request.url).searchParams.get("board");
  if (!boardId) {
    return NextResponse.json({ error: "Missing board" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ("response" in admin) return admin.response;

  const { data: board, error } = await supabase
    .from("sales_boards")
    .select("data, access_code")
    .eq("id", boardId)
    .eq("owner_id", admin.userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const data = (board.data as SalesBoardData) ?? DEFAULT_BOARD_DATA;
  return NextResponse.json({
    deals: data.deals ?? [],
    closers: data.closers ?? [],
    setters: data.setters ?? [],
    onboarding: data.onboarding ?? null,
    accessCode: board.access_code,
  });
}
