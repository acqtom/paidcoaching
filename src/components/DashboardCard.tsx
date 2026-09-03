import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Card } from "@/lib/cards";

export function DashboardCard({ card, unread }: { card: Card; unread?: boolean }) {
  const Icon = card.icon;
  const gold = card.accent === "gold" && !unread;
  const green = !!unread;

  const isExternal = card.href.startsWith("http");

  return (
    <Link
      href={card.href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={
        green
          ? "group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-emerald-300/60 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-500/15 dark:to-emerald-900/30 p-6 shadow-lg shadow-emerald-300/50 dark:shadow-black/50 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:from-emerald-50 hover:to-emerald-100 dark:hover:from-emerald-500/25 dark:hover:to-emerald-900/40 hover:shadow-xl hover:shadow-emerald-300/70 dark:hover:shadow-black/70"
          : gold
            ? "group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-amber-300/60 dark:border-amber-500/30 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-500/15 dark:to-amber-900/30 p-6 shadow-lg shadow-amber-300/50 dark:shadow-black/50 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:from-amber-50 hover:to-amber-100 dark:hover:from-amber-500/25 dark:hover:to-amber-900/40 hover:shadow-xl hover:shadow-amber-300/70 dark:hover:shadow-black/70"
            : "group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-6 shadow-lg shadow-neutral-300/40 dark:shadow-black/50 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:from-white hover:to-neutral-100 dark:hover:from-neutral-700 dark:hover:to-neutral-800 hover:shadow-xl hover:shadow-neutral-300/60 dark:hover:shadow-black/70"
      }
    >
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {card.title}
        </h2>
        <span
          className={
            green
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300/60 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-300"
              : gold
                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/60 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300"
                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
          }
        >
          <Icon size={18} strokeWidth={2} />
        </span>
      </div>

      <div>
        <p className="text-sm text-neutral-500">{card.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <span
            className={
              green
                ? "text-xs font-semibold tracking-wide text-emerald-700 dark:text-emerald-400"
                : gold
                  ? "text-xs font-semibold tracking-wide text-amber-700 dark:text-amber-400"
                  : "text-xs font-semibold tracking-wide text-neutral-400 dark:text-neutral-500"
            }
          >
            {green ? "NEW MESSAGES" : gold ? "START HERE" : "OPEN"}
          </span>
          <ArrowUpRight
            size={16}
            className={
              green
                ? "text-emerald-600 transition-colors group-hover:text-emerald-800 dark:text-emerald-400 dark:group-hover:text-emerald-300"
                : gold
                  ? "text-amber-600 transition-colors group-hover:text-amber-800 dark:text-amber-400 dark:group-hover:text-amber-300"
                  : "text-neutral-400 transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
            }
          />
        </div>
      </div>
    </Link>
  );
}
