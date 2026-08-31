import { createClient } from "@/lib/supabase/server";
import { generateAccessCode } from "@/lib/access-code";

export type SalesBoardData = {
  deals?: unknown[];
  closers?: unknown[];
  setters?: unknown[];
  // The dashboard's "Today's Cash Collected" card target -- lives here
  // rather than a new table since it's a Sales Board concept through and
  // through, and this row is already private per portal user.
  dailyCashTarget?: number | null;
};

export const DEFAULT_SALES_BOARD_DATA: SalesBoardData = {
  deals: [],
  closers: [],
  setters: [],
  dailyCashTarget: null,
};

const UNIQUE_VIOLATION = "23505";
const MAX_CODE_ATTEMPTS = 5;

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Fetches this user's sales_board_state row, creating it (with a freshly
// generated, guaranteed-unique access code) if it doesn't exist yet. Shared
// by /session (first load) and /save, so a save that races ahead of a
// user's first load still ends up with a real access_code rather than a
// null one.
export async function ensureSalesBoardRow(supabase: Supabase, userId: string) {
  const { data: row, error } = await supabase
    .from("sales_board_state")
    .select("data, access_code")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (row) return row as { data: SalesBoardData; access_code: string | null };

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const accessCode = generateAccessCode();
    const { data: inserted, error: insertError } = await supabase
      .from("sales_board_state")
      .insert({ id: userId, data: DEFAULT_SALES_BOARD_DATA, access_code: accessCode })
      .select("data, access_code")
      .single();

    if (!insertError) return inserted as { data: SalesBoardData; access_code: string | null };
    if (insertError.code !== UNIQUE_VIOLATION) throw new Error(insertError.message);
    // access_code collision (astronomically unlikely) -- try another code.
  }
  throw new Error("Could not generate a unique access code");
}
