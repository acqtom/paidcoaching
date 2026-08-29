"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Bug, X } from "lucide-react";
import { submitBugReport } from "@/lib/bug-report-actions";
import type { ActionState } from "@/lib/auth-actions";
import { CARDS } from "@/lib/cards";
import { FormError, FormNotice, SubmitButton } from "@/components/AuthCard";

const initialState: ActionState = {};

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    submitBugReport,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <Bug size={14} />
        Submit a bug
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Submit a bug</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                <X size={18} />
              </button>
            </div>

            {state.success ? (
              <div className="mt-4">
                <FormNotice message={state.success} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-4 w-full rounded-lg bg-neutral-900 dark:bg-neutral-100 px-3 py-2 text-sm font-medium text-white dark:text-neutral-900 hover:opacity-90"
                >
                  Close
                </button>
              </div>
            ) : (
              <form ref={formRef} action={formAction} className="mt-4 space-y-4">
                <FormError message={state.error} />

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    What feature does this have to do with?
                  </span>
                  <select
                    name="feature"
                    required
                    defaultValue=""
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                  >
                    <option value="" disabled>
                      Select a feature
                    </option>
                    {CARDS.map((card) => (
                      <option key={card.slug} value={card.title}>
                        {card.title}
                      </option>
                    ))}
                    <option value="Something else">Something else</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    What is wrong?
                  </span>
                  <textarea
                    name="whatsWrong"
                    required
                    rows={3}
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    What do you think it should do instead?
                  </span>
                  <textarea
                    name="expected"
                    required
                    rows={3}
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                  />
                </label>

                <SubmitButton pending={pending}>Submit</SubmitButton>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
