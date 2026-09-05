import type { ReactNode } from "react";
import { DollarSign, TrendingUp, Users, UserPlus, Clock3 } from "lucide-react";

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function formatDuration(totalSeconds: number) {
  const seconds = Math.round(totalSeconds);
  if (seconds < 60) return "< 1m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-5 shadow-lg shadow-neutral-300/40 dark:shadow-black/50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {label}
        </p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-neutral-500">{sub}</p> : null}
    </div>
  );
}

export function SummaryCards({
  totalRevenue,
  revenue90,
  revenue30,
  totalAccounts,
  totalUsers,
  avgDailySeconds,
}: {
  totalRevenue: number;
  revenue90: number;
  revenue30: number;
  totalAccounts: number;
  totalUsers: number;
  avgDailySeconds: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label="Total Student Revenue"
        value={fmtUSD(totalRevenue)}
        sub="All-time, across every student's own Sales Board"
        icon={<DollarSign size={16} strokeWidth={2} />}
      />
      <StatCard
        label="Revenue — Last 90 Days"
        value={fmtUSD(revenue90)}
        icon={<TrendingUp size={16} strokeWidth={2} />}
      />
      <StatCard
        label="Revenue — Last 30 Days"
        value={fmtUSD(revenue30)}
        icon={<TrendingUp size={16} strokeWidth={2} />}
      />
      <StatCard
        label="Total Accounts"
        value={String(totalAccounts)}
        sub="Students only"
        icon={<Users size={16} strokeWidth={2} />}
      />
      <StatCard
        label="Total Users"
        value={String(totalUsers)}
        sub="Accounts + closers/setters added to Sales Boards"
        icon={<UserPlus size={16} strokeWidth={2} />}
      />
      <StatCard
        label="Avg. Time Spent / Day"
        value={formatDuration(avgDailySeconds)}
        sub="Per active student, per day"
        icon={<Clock3 size={16} strokeWidth={2} />}
      />
    </div>
  );
}
