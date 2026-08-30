import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Single shared JSON blob backing the Daily Kill List's persistent
// Marketing/Sales/Operations/Fulfilment backlog + Yearly Goals -- not
// scoped to the selected day (see /api/daily-kill-list/state for that).
// Reuses the task_backlog_state table from the original standalone Task
// Backlog port (just a jsonb column, so no migration needed for the
// updated shape). Mirrors the original app's GET -> board / POST -> board
// contract (the board itself, not wrapped).

const DEFAULT_BOARD = {
  tasks: [] as unknown[],
  yearlyGoals: [] as unknown[],
  updatedAt: 0,
};

export async function GET() {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("task_backlog_state")
    .select("data")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(row?.data ?? DEFAULT_BOARD);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  const board = {
    tasks: Array.isArray(body.tasks) ? body.tasks : [],
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
