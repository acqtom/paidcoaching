import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Card } from "@/lib/cards";

export function DashboardCard({ card }: { card: Card }) {
  const Icon = card.icon;

  return (
    <Link
      href={`/dashboard/${card.slug}`}
      className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-6 shadow-lg shadow-neutral-300/40 dark:shadow-black/50 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:from-white hover:to-neutral-100 dark:hover:from-neutral-700 dark:hover:to-neutral-800 hover:shadow-xl hover:shadow-neutral-300/60 dark:hover:shadow-black/70"
    >
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {card.title}
        </h2>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
          <Icon size={18} strokeWidth={2} />
        </span>
      </div>

      <div>
        <p className="text-sm text-neutral-500">{card.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-neutral-400 dark:text-neutral-500">
            COMING SOON
          </span>
          <ArrowUpRight
            size={16}
            className="text-neutral-400 transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
          />
        </div>
      </div>
    </Link>
  );
}
