import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { isAdminUsername } from "@/lib/is-admin-username";
import { StudentTable } from "./StudentTable";
import { SummaryCards } from "./SummaryCards";

const PROGRAM_MONTHS = 3;

export type Student = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_path: string | null;
  email: string;
  created_at: string;
  end_date: string;
  progress_pct: number;
  amount_paid_upfront: number;
  amount_due: number;
  due_date: string | null;
  paid: boolean;
};

// Row shape returned by the admin_list_students() RPC
// (0020_student_data.sql) -- this project has no generated Supabase
// types, so .rpc() calls come back untyped; this is just enough to type
// the .map() below.
type StudentRow = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_path: string | null;
  email: string;
  created_at: string;
};

type PaymentRow = {
  user_id: string;
  amount_paid_upfront: number;
  amount_due: number;
  due_date: string | null;
  paid: boolean;
};

// Deal shape inside a Sales Board's own data.deals -- same fields
// dashboard/page.tsx's "Today's Cash Collected" card reads.
type Deal = { closingDate?: string; callOutcome?: string; cashCollected?: number | string | null };

// Row shape returned by admin_list_student_sales_data() -- each
// student's own sales_board_state.data (0024_student_data_summary.sql).
type SalesDataRow = {
  user_id: string;
  data: { deals?: Deal[]; closers?: string[]; setters?: string[] } | null;
};

export default async function StudentDataPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAdminUsername(profile?.username ?? "")) redirect("/dashboard");

  const { data: rows } = await supabase.rpc("admin_list_students");
  const studentRows = (rows ?? []) as StudentRow[];

  const { data: paymentRows } =
    studentRows.length > 0
      ? await supabase
          .from("student_payments")
          .select("user_id, amount_paid_upfront, amount_due, due_date, paid")
          .in(
            "user_id",
            studentRows.map((r) => r.id)
          )
      : { data: [] };
  const paymentsByUser = new Map<string, PaymentRow>(
    ((paymentRows ?? []) as PaymentRow[]).map((p) => [p.user_id, p])
  );

  const now = new Date();
  const students: Student[] = studentRows.map((r) => {
    const createdAt = new Date(r.created_at);
    const endDate = new Date(createdAt);
    endDate.setMonth(endDate.getMonth() + PROGRAM_MONTHS);
    const totalMs = endDate.getTime() - createdAt.getTime();
    const progress = totalMs > 0 ? ((now.getTime() - createdAt.getTime()) / totalMs) * 100 : 0;
    const payment = paymentsByUser.get(r.id);
    return {
      id: r.id,
      username: r.username,
      full_name: r.full_name,
      avatar_path: r.avatar_path,
      email: r.email,
      created_at: r.created_at,
      end_date: endDate.toISOString(),
      progress_pct: Math.max(0, Math.min(100, progress)),
      amount_paid_upfront: payment?.amount_paid_upfront ?? 0,
      amount_due: payment?.amount_due ?? 0,
      due_date: payment?.due_date ?? null,
      paid: payment?.paid ?? false,
    };
  });

  // Summary cards -- revenue students have collected in their OWN Sales
  // Boards (not anything the coaching business charged them), plus a
  // headcount that also folds in the closers/setters each student has
  // added to their own board's team.
  const { data: salesDataRows } = await supabase.rpc("admin_list_student_sales_data");
  const salesRows = (salesDataRows ?? []) as SalesDataRow[];

  const nowMs = now.getTime();
  const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;
  const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

  let totalRevenue = 0;
  let revenue90 = 0;
  let revenue30 = 0;
  let teamMemberCount = 0;

  for (const row of salesRows) {
    const deals = row.data?.deals ?? [];
    for (const d of deals) {
      if (d.callOutcome !== "Closed/Won/Deposit") continue;
      const amount = Number(d.cashCollected) || 0;
      totalRevenue += amount;
      const closingMs = d.closingDate ? new Date(`${d.closingDate}T00:00:00`).getTime() : NaN;
      if (!Number.isNaN(closingMs)) {
        const age = nowMs - closingMs;
        if (age <= MS_90_DAYS) revenue90 += amount;
        if (age <= MS_30_DAYS) revenue30 += amount;
      }
    }
    const teamNames = new Set(
      [...(row.data?.closers ?? []), ...(row.data?.setters ?? [])]
        .map((n) => n.trim().toLowerCase())
        .filter(Boolean)
    );
    teamMemberCount += teamNames.size;
  }

  const totalAccounts = studentRows.length;
  const totalUsers = totalAccounts + teamMemberCount;

  const { data: avgSecondsRaw } = await supabase.rpc("admin_average_daily_activity_seconds");
  const avgDailySeconds = Number(avgSecondsRaw) || 0;

  return (
    <div className="min-h-full flex-1 bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Logo />
          <Link
            href="/dashboard"
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-xl font-semibold">Student Data</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every student who&apos;s joined, their {PROGRAM_MONTHS}-month program timeline, and intake form submissions.
        </p>

        <div className="mt-6">
          <SummaryCards
            totalRevenue={totalRevenue}
            revenue90={revenue90}
            revenue30={revenue30}
            totalAccounts={totalAccounts}
            totalUsers={totalUsers}
            avgDailySeconds={avgDailySeconds}
          />
        </div>

        <div className="mt-6">
          <StudentTable students={students} />
        </div>
      </main>
    </div>
  );
}
