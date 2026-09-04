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

  const now = new Date();
  const students: Student[] = ((rows ?? []) as StudentRow[]).map((r) => {
    const createdAt = new Date(r.created_at);
    const endDate = new Date(createdAt);
    endDate.setMonth(endDate.getMonth() + PROGRAM_MONTHS);
    const totalMs = endDate.getTime() - createdAt.getTime();
    const progress = totalMs > 0 ? ((now.getTime() - createdAt.getTime()) / totalMs) * 100 : 0;
    return {
      id: r.id,
      username: r.username,
      full_name: r.full_name,
      avatar_path: r.avatar_path,
      email: r.email,
      created_at: r.created_at,
      end_date: endDate.toISOString(),
      progress_pct: Math.max(0, Math.min(100, progress)),
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
