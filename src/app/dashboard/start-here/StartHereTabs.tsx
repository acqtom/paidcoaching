"use client";

import { useState } from "react";
import { Briefcase, Megaphone } from "lucide-react";
import { VideoPlaceholder } from "./VideoPlaceholder";
import { CalendlyPlaceholder } from "./CalendlyPlaceholder";
import { NavigationTable } from "./NavigationTable";
import { TypeformFlow } from "@/components/TypeformFlow";
import { CEO_QUESTIONS, CMO_QUESTIONS } from "@/lib/intake-forms";

const TABS = [
  { id: "CMO", label: "CMO", sub: "Marketing lead", icon: Megaphone },
  { id: "CEO", label: "CEO", sub: "Account owner", icon: Briefcase },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function StartHereTabs({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("CMO");

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                active
                  ? "flex items-center gap-3 rounded-2xl border border-amber-300/60 dark:border-amber-500/30 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-500/15 dark:to-amber-900/30 p-4 text-left shadow-lg shadow-amber-300/50 dark:shadow-black/50 transition-all duration-200 ease-out"
                  : "flex items-center gap-3 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neutral-300/40 dark:hover:shadow-black/50"
              }
            >
              <span
                className={
                  active
                    ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/60 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300"
                    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
                }
              >
                <Icon size={18} strokeWidth={2} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t.label}
                </span>
                <span className="block text-xs text-neutral-500">{t.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-6">
        {tab === "CMO" ? (
          <>
            <VideoPlaceholder label="CMO welcome video" />
            <CalendlyPlaceholder />
            <TypeformFlow formId="cmo" title="Marketing intake" questions={CMO_QUESTIONS} userId={userId} />
          </>
        ) : (
          <>
            <VideoPlaceholder label="CEO welcome video" />
            <CalendlyPlaceholder />
            {CEO_QUESTIONS.length > 0 && (
              <TypeformFlow formId="ceo" title="Business intake" questions={CEO_QUESTIONS} userId={userId} />
            )}
            <div>
              <h2 className="text-lg font-semibold">Where everything lives</h2>
              <p className="mt-1 text-sm text-neutral-500">
                What each card on the dashboard does and where it takes you.
              </p>
              <div className="mt-4">
                <NavigationTable />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
