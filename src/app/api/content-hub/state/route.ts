import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAccessCode } from "@/lib/content-hub-code";

// Per-user JSON blob backing the Weekly Content Hub (Kanban board +
// Content documents + Team roster). Unlike every other stateful feature in
// this app, this one is private to each account (see
// supabase/migrations/0005_content_hub_state.sql) -- gated by auth.uid()
// rather than a shared singleton row. The row also carries an access_code
// column, generated the first time this route runs for a given user, so
// every account has one from day one without needing a separate migration
// trigger to cover users who signed up before this feature existed.

const DEFAULT_STATE = {
  kanban: [] as unknown[],
  documents: [] as unknown[],
  teamMembers: [] as unknown[],
  contentCalendar: { columns: [], cells: {} } as { columns: unknown[]; cells: Record<string, unknown> },
  updatedAt: 0,
};

const UNIQUE_VIOLATION = "23505";
const MAX_CODE_ATTEMPTS = 5;

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Fetches this user's row, creating it (with a freshly generated,
// guaranteed-unique access code) if it doesn't exist yet.
async function ensureRow(supabase: Supabase, userId: string) {
  const { data: row, error } = await supabase
    .from("content_hub_state")
    .select("data, access_code")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (row) return row;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const accessCode = generateAccessCode();
    const { data: inserted, error: insertError } = await supabase
      .from("content_hub_state")
      .insert({ id: userId, data: DEFAULT_STATE, access_code: accessCode })
      .select("data, access_code")
      .single();

    if (!insertError) return inserted;
    if (insertError.code !== UNIQUE_VIOLATION) throw new Error(insertError.message);
    // access_code collision (astronomically unlikely) -- try another code.
  }
  throw new Error("Could not generate a unique access code");
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const row = await ensureRow(supabase, user.id);
    return NextResponse.json({ ...(row.data as object ?? DEFAULT_STATE), accessCode: row.access_code });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
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
    teamMembers: Array.isArray(body.teamMembers) ? body.teamMembers : [],
    contentCalendar:
      body.contentCalendar && Array.isArray(body.contentCalendar.columns) && typeof body.contentCalendar.cells === "object"
        ? body.contentCalendar
        : DEFAULT_STATE.contentCalendar,
    updatedAt: Date.now(),
  };

  try {
    // Make sure the row (and its access_code) exists before updating it --
    // covers the edge case of a save racing ahead of this user's first GET.
    const existing = await ensureRow(supabase, user.id);

    const { error } = await supabase
      .from("content_hub_state")
      .update({ data: state, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ...state, accessCode: existing.access_code });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
