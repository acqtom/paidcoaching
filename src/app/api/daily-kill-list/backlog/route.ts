import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Private per portal account -- this user's own JSON blob backing the
// Daily Kill List's persistent Marketing/Sales/Operations/Fulfilment
// backlog + Yearly Goals -- not scoped to the selected day (see
// /api/daily-kill-list/state for that). Reuses the task_backlog_state
// table from the original standalone Task Backlog port (see
// supabase/migrations/0018_private_daily_kill_list.sql). Mirrors the
// original app's GET -> board / POST -> board contract (the board
// itself, not wrapped).

const DEFAULT_BOARD = {
  tasks: [] as unknown[],
  yearlyGoals: [] as unknown[],
  updatedAt: 0,
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("task_backlog_state")
    .select("data")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(row?.data ?? DEFAULT_BOARD);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  const board = {
    tasks: Array.isArray(body.tasks) ? body.tasks : [],
    yearlyGoals: Array.isArray(body.yearlyGoals) ? body.yearlyGoals : [],
    updatedAt: Date.now(),
  };

  const { error } = await supabase
    .from("task_backlog_state")
    .upsert({ id: user.id, data: board, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(board);
}
