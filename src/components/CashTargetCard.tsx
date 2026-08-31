"use client";

import { useState } from "react";
import Link from "next/link";
import { DollarSign, ArrowUpRight } from "lucide-react";

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function CashTargetCard({
  todayCash,
  initialTarget,
}: {
  todayCash: number;
  initialTarget: number | null;
}) {
  const [target, setTarget] = useState(initialTarget);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(initialTarget != null ? String(initialTarget) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = target ? Math.min(100, (todayCash / target) * 100) : 0;
  const barColor = !target ? "bg-neutral-300 dark:bg-neutral-700" : pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-rose-500";

  async function saveTarget(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sales-board/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyCashTarget: parsed }),
      });
      if (!res.ok) throw new Error("Save failed");
      setTarget(parsed);
      setEditing(false);
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-6 shadow-lg shadow-neutral-300/40 dark:shadow-black/50">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Today&apos;s Cash Collected
        </h2>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
          <DollarSign size={18} strokeWidth={2} />
        </span>
      </div>

      <div>
        <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{fmtUSD(todayCash)}</p>

        {!editing ? (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-300/70 dark:bg-neutral-700/70">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-xs text-neutral-500">
              {target != null ? `of ${fmtUSD(target)}` : "no target set"}
            </span>
          </div>
        ) : null}

        {editing ? (
          <form onSubmit={saveTarget} className="mt-3 flex items-center gap-2">
            <input
              autoFocus
              type="number"
              min="0"
              step="1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Daily target ($)"
              className="w-32 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm outline-none focus:border-neutral-500"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-neutral-900 dark:bg-neutral-100 px-3 py-1 text-xs font-medium text-white dark:text-neutral-900 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setInputValue(target != null ? String(target) : "");
                setError(null);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Cancel
            </button>
          </form>
        ) : null}
        {error ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}

        <div className="mt-3 flex items-center justify-between">
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-semibold tracking-wide text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
            >
              {target != null ? "EDIT TARGET" : "SET TARGET"}
            </button>
          ) : (
            <span />
          )}
          <Link
            href="/dashboard/sales-board"
            className="flex items-center gap-1 text-xs font-semibold tracking-wide text-neutral-400 hover:text-indigo-600 dark:text-neutral-500 dark:hover:text-indigo-400"
          >
            SALES BOARD
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
