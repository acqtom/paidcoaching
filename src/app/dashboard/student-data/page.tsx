import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { isAdminUsername } from "@/lib/is-admin-username";
import { StudentTable } from "./StudentTable";

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
          <StudentTable students={students} />
        </div>
      </main>
    </div>
  );
}
