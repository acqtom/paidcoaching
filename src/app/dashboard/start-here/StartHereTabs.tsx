"use client";

import { useState } from "react";
import { VideoPlaceholder } from "./VideoPlaceholder";
import { NewStudentForm } from "./NewStudentForm";
import { NavigationTable } from "./NavigationTable";

const TABS = ["CMO", "CEO"] as const;
type Tab = (typeof TABS)[number];

export function StartHereTabs() {
  const [tab, setTab] = useState<Tab>("CMO");

  return (
    <div>
      <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-1.5 text-sm font-medium text-white dark:text-neutral-900"
                : "rounded-md px-4 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {tab === "CMO" ? (
          <>
            <VideoPlaceholder label="CMO welcome video" />
            <div>
              <h2 className="text-lg font-semibold">New student form</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Fill this in for every new student joining the program.
              </p>
              <div className="mt-4 max-w-md">
                <NewStudentForm />
              </div>
            </div>
          </>
        ) : (
          <>
            <VideoPlaceholder label="CEO welcome video" />
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
