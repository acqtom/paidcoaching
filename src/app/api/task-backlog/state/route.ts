import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Single shared JSON blob backing the Prioritization Task Backlog's
// cross-device sync (see supabase/migrations/0004_task_backlog_state.sql).
// Mirrors the original app's GET -> board / POST -> board contract (the
// board itself, not wrapped) so the ported frontend script needs no
// changes beyond the endpoint path.

const DEFAULT_BOARD = {
  tasks: [] as unknown[],
  clients: ["Adriel", "Alex"],
  yearlyGoals: [] as unknown[],
  updatedAt: 0,
};

export async function GET() {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("task_backlog_state")
    .select("data")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json(row?.data ?? DEFAULT_BOARD);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  const board = {
    tasks: Array.isArray(body.tasks) ? body.tasks : [],
    clients: Array.isArray(body.clients) && body.clients.length ? body.clients : DEFAULT_BOARD.clients,
    yearlyGoals: Array.isArray(body.yearlyGoals) ? body.yearlyGoals : [],
    updatedAt: Date.now(),
  };

  const { error } = await supabase
    .from("task_backlog_state")
    .upsert({ id: 1, data: board, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(board);
}
