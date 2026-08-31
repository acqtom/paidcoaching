import Link from "next/link";
import { ArrowUpRight, Flame } from "lucide-react";

export function UrgentTasksCard({
  tasks,
  totalCount,
}: {
  tasks: { id: string; text: string }[];
  totalCount: number;
}) {
  return (
    <Link
      href="/dashboard/daily-kill-list"
      className="group relative flex min-h-[145px] flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-5 shadow-lg shadow-neutral-300/40 dark:shadow-black/50 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:from-white hover:to-neutral-100 dark:hover:from-neutral-700 dark:hover:to-neutral-800 hover:shadow-xl hover:shadow-neutral-300/60 dark:hover:shadow-black/70"
    >
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Urgent To-Do</h2>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
          <Flame size={16} strokeWidth={2} />
        </span>
      </div>

      <div>
        {tasks.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing starred right now.</p>
        ) : (
          <ul className="space-y-1">
            {tasks.map((t) => (
              <li key={t.id} className="truncate text-sm text-neutral-700 dark:text-neutral-300">
                &#9733; {t.text}
              </li>
            ))}
            {totalCount > tasks.length ? (
              <li className="text-xs text-neutral-400">+{totalCount - tasks.length} more</li>
            ) : null}
          </ul>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-neutral-400 dark:text-neutral-500">OPEN</span>
          <ArrowUpRight
            size={16}
            className="text-neutral-400 transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
          />
        </div>
      </div>
    </Link>
  );
}
