import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Anonymous, no-login access to a single user's Weekly Content Hub via
// their 5-character secret key. Both operations go through SECURITY
// DEFINER Postgres functions (see supabase/migrations/0005_...sql) that
// look up or overwrite exactly one row's data blob by access_code and
// return nothing else about that row -- no service-role key needed, and
// there's no way to enumerate or reach any row without already knowing
// its code.

const DEFAULT_STATE = {
  kanban: [] as unknown[],
  documents: [] as unknown[],
  teamMembers: [] as unknown[],
  updatedAt: 0,
};

function normalizeCode(raw: string | null) {
  return (raw ?? "").trim().toUpperCase();
}

export async function GET(request: Request) {
  const code = normalizeCode(new URL(request.url).searchParams.get("code"));
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_content_hub_by_code", { p_code: code });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Invalid or unknown secret key" }, { status: 404 });
  }

  return NextResponse.json({ ...(data as object ?? DEFAULT_STATE), accessCode: code });
}

export async function POST(request: Request) {
  const code = normalizeCode(new URL(request.url).searchParams.get("code"));
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const body = await request.json();
  const state = {
    kanban: Array.isArray(body.kanban) ? body.kanban : [],
    documents: Array.isArray(body.documents) ? body.documents : [],
    teamMembers: Array.isArray(body.teamMembers) ? body.teamMembers : [],
    updatedAt: Date.now(),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_content_hub_by_code", {
    p_code: code,
    p_data: state,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Invalid or unknown secret key" }, { status: 404 });
  }

  return NextResponse.json({ ...state, accessCode: code });
}
