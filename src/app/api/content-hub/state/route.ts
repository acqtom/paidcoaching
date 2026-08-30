import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Per-user JSON blob backing the Weekly Content Hub (Kanban board +
// Content documents). Unlike every other stateful feature in this app,
// this one is private to each account (see
// supabase/migrations/0005_content_hub_state.sql) -- gated by auth.uid()
// rather than a shared singleton row.

const DEFAULT_STATE = {
  kanban: [] as unknown[],
  documents: [] as unknown[],
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
    .from("content_hub_state")
    .select("data")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(row?.data ?? DEFAULT_STATE);
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
  const state = {
    kanban: Array.isArray(body.kanban) ? body.kanban : [],
    documents: Array.isArray(body.documents) ? body.documents : [],
    updatedAt: Date.now(),
  };

  const { error } = await supabase
    .from("content_hub_state")
    .upsert({ id: user.id, data: state, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(state);
}
