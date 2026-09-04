import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { isAdminUsername } from "@/lib/is-admin-username";
import { BoardSwitcher } from "@/components/BoardSwitcher";

export default async function SalesBoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  const isAdmin = isAdminUsername(profile?.username ?? "");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Logo />
          <Link
            href="/dashboard"
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      {isAdmin ? (
        <BoardSwitcher
          mode="sales-board"
          iframeTitle="Sales Team Board"
          emptyMessage="No boards yet — running multiple offers at once? Add your first one above."
        />
      ) : (
        <iframe
          src="/sales-board-app/index.html"
          title="Sales Team Board"
          className="flex-1 w-full border-0"
        />
      )}
    </div>
  );
}
