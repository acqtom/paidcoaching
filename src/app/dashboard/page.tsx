import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth-actions";
import { CARDS } from "@/lib/cards";
import { Logo } from "@/components/Logo";
import { DashboardCard } from "@/components/DashboardCard";
import { BugReportButton } from "@/components/BugReportButton";
import { ProfileButton } from "@/components/ProfileModal";
import { CashTargetCard } from "@/components/CashTargetCard";
import { UrgentTasksCard } from "@/components/UrgentTasksCard";

type Deal = { closingDate?: string; callOutcome?: string; cashCollected?: number | string | null };
type BacklogTask = {
  id: string;
  text: string;
  priority?: boolean;
  done?: boolean;
  lastCompletedDate?: string | null;
  repeat?: { days: number[] } | null;
};

// Matches isTaskDone() in public/daily-kill-list-app/app.js: a repeating
// task is "done" only for today (lastCompletedDate === today), everything
// else just uses its own `done` flag.
function isTaskDoneToday(task: BacklogTask, todayISO: string) {
  const isRepeating = !!(task.repeat && task.repeat.days && task.repeat.days.length);
  return isRepeating ? task.lastCompletedDate === todayISO : !!task.done;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("username, avatar_path")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  // Today's Cash Collected -- this user's own Sales Board deals closed today.
  const todayISO = new Date().toISOString().slice(0, 10);
  const { data: salesBoardRow } = user
    ? await supabase.from("sales_board_state").select("data").eq("id", user.id).maybeSingle()
    : { data: null };
  const deals = (salesBoardRow?.data?.deals as Deal[] | undefined) ?? [];
  const todayCash = deals
    .filter((d) => d.closingDate === todayISO && d.callOutcome === "Closed/Won/Deposit")
    .reduce((sum, d) => sum + (Number(d.cashCollected) || 0), 0);
  const dailyCashTarget = (salesBoardRow?.data?.dailyCashTarget as number | null | undefined) ?? null;

  // Urgent To-Do -- starred, not-yet-done tasks from this user's own backlog.
  const { data: backlogRow } = user
    ? await supabase.from("task_backlog_state").select("data").eq("id", user.id).maybeSingle()
    : { data: null };
  const allTasks = (backlogRow?.data?.tasks as BacklogTask[] | undefined) ?? [];
  const urgentTasks = allTasks.filter((t) => t.priority && !isTaskDoneToday(t, todayISO));

  // Communications card goes green if any channel or this user's DM has a
  // message they haven't read yet -- see has_unread_communications() in
  // 0011_conversation_reads.sql.
  const { data: hasUnread } = user ? await supabase.rpc("has_unread_communications") : { data: false };

  return (
    <div className="min-h-full flex-1 bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-4">
            {user && (
              <ProfileButton
                userId={user.id}
                initialUsername={profile?.username ?? user.email ?? "you"}
                initialAvatarPath={profile?.avatar_path ?? null}
              />
            )}
            <BugReportButton />
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          Student Portal
        </p>
        <h1 className="mt-1 text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick a workspace to jump in.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <CashTargetCard todayCash={todayCash} initialTarget={dailyCashTarget} />
          </div>
          <UrgentTasksCard tasks={urgentTasks.slice(0, 2)} totalCount={urgentTasks.length} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <DashboardCard
              key={card.slug}
              card={card}
              unread={card.slug === "communications" ? !!hasUnread : undefined}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
