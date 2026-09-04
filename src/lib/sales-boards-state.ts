import { createClient } from "@/lib/supabase/server";
import { generateAccessCode } from "@/lib/access-code";
import type { SalesBoardData } from "@/lib/sales-board-state";

export const DEFAULT_BOARD_DATA: SalesBoardData = {
  deals: [],
  closers: [],
  setters: [],
  dailyCashTarget: null,
  onboarding: null,
};

const UNIQUE_VIOLATION = "23505";
const MAX_CODE_ATTEMPTS = 5;

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SalesBoard = {
  id: string;
  name: string;
  access_code: string | null;
  created_at: string;
};

// Creates a new board owned by the given user, retrying on the
// (astronomically unlikely) access-code collision -- same pattern as
// ensureSalesBoardRow (src/lib/sales-board-state.ts) for the original
// singleton system. RLS on `sales_boards` (0023_multi_sales_boards.sql)
// independently re-checks the caller is really an admin who owns this
// row, but every route calling this should still gate on
// isAdminUsername() up front so a non-admin gets a clean 403 instead of
// an opaque RLS rejection.
export async function createSalesBoard(supabase: Supabase, ownerId: string, name: string): Promise<SalesBoard> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const accessCode = generateAccessCode();
    const { data, error } = await supabase
      .from("sales_boards")
      .insert({ owner_id: ownerId, name, access_code: accessCode, data: DEFAULT_BOARD_DATA })
      .select("id, name, access_code, created_at")
      .single();
    if (!error) return data as SalesBoard;
    if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
    // access_code collision -- try another code.
  }
  throw new Error("Could not generate a unique access code");
}
