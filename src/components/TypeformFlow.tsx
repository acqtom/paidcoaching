"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TypeformQuestion } from "@/lib/intake-forms";

type Phase = "loading" | "answering" | "submitting" | "done";

// Owns its own draft text so switching questions doesn't need an effect
// to reset it -- the parent renders this with `key={question.id}`, so
// React remounts a fresh instance (seeded from any previously-entered
// answer via `initialValue`) whenever the visible question changes,
// rather than one instance whose state has to be synced across changes.
function ShortTextQuestion({
  initialValue,
  placeholder,
  isLast,
  submitting,
  onAdvance,
}: {
  initialValue: string;
  placeholder?: string;
  isLast: boolean;
  submitting: boolean;
  onAdvance: (value: string) => void;
}) {
  const [draft, setDraft] = useState(initialValue);

  function advance() {
    const value = draft.trim();
    if (!value) return;
    onAdvance(value);
  }

  return (
    <div className="mt-5">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            advance();
          }
        }}
        placeholder={placeholder}
        className="w-full border-b-2 border-neutral-200 bg-transparent px-1 py-2 text-lg text-neutral-900 outline-none focus:border-amber-500 dark:border-neutral-700 dark:text-neutral-100"
      />
      <button
        type="button"
        onClick={advance}
        disabled={!draft.trim() || submitting}
        className="mt-4 flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isLast ? (submitting ? "Submitting…" : "Submit") : "OK"}
        <ArrowRight size={14} />
      </button>
      <p className="mt-2 text-xs text-neutral-400">press Enter ↵</p>
    </div>
  );
}

// A one-question-at-a-time flow in the style of Typeform: full-width
// card, one question visible at a time, a thin progress bar, Enter/
// number-key navigation, a back arrow, and no visible submit button
// until the last question. Fully generic over `questions` so the same
// component backs both the CMO and CEO intake forms -- just a different
// `formId` (which row of intake_form_submissions it reads/writes) and
// question list.
export function TypeformFlow({
  formId,
  title,
  questions,
  userId,
}: {
  formId: "cmo" | "ceo";
  title: string;
  questions: TypeformQuestion[];
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<Phase>("loading");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(true);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("intake_form_submissions")
        .select("answers, submitted_at")
        .eq("user_id", userId)
        .eq("form", formId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setAnswers((data.answers as Record<string, string>) ?? {});
        setSubmittedAt(data.submitted_at as string);
        setPhase("done");
      } else {
        setPhase("answering");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, userId]);

  function goTo(nextIndex: number) {
    setVisible(false);
    setTimeout(() => {
      setIndex(nextIndex);
      setVisible(true);
    }, 150);
  }

  async function submit(finalAnswers: Record<string, string>) {
    setPhase("submitting");
    setError(null);
    const { data, error: upsertError } = await supabase
      .from("intake_form_submissions")
      .upsert(
        { user_id: userId, form: formId, answers: finalAnswers, submitted_at: new Date().toISOString() },
        { onConflict: "user_id,form" }
      )
      .select("submitted_at")
      .single();
    if (upsertError || !data) {
      setError("Couldn't submit — try again.");
      setPhase("answering");
      return;
    }
    setSubmittedAt(data.submitted_at as string);
    setPhase("done");
  }

  function answerAndAdvance(value: string) {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    if (isLast) {
      submit(next);
    } else {
      goTo(index + 1);
    }
  }

  function goBack() {
    if (index === 0) return;
    goTo(index - 1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (question?.type === "single_select" && /^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < question.options.length) answerAndAdvance(question.options[i]);
    }
  }

  if (phase === "loading") {
    return (
      <div className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg shadow-neutral-300/40 dark:shadow-black/50">
        <p className="text-sm text-neutral-400">Loading…</p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="rounded-2xl border border-amber-300/60 dark:border-amber-500/30 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-500/15 dark:to-amber-900/30 p-6 shadow-lg shadow-amber-300/50 dark:shadow-black/50">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/60 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300">
            <Check size={18} strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title} — submitted</p>
            {submittedAt && (
              <p className="text-xs text-neutral-500">
                {new Date(submittedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setPhase("answering");
          }}
          className="mt-4 text-sm font-medium text-amber-800 underline hover:opacity-80 dark:text-amber-300"
        >
          Edit your answers
        </button>
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg shadow-neutral-300/40 dark:shadow-black/50 outline-none"
    >
      <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className="h-1 bg-amber-500 transition-all duration-300 ease-out"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="flex min-h-[220px] flex-col justify-center p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {title} · {index + 1} of {questions.length}
          </p>
          {index > 0 && (
            <button
              type="button"
              onClick={goBack}
              title="Previous question"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <ChevronUp size={16} />
            </button>
          )}
        </div>

        <div
          className={`mt-3 transition-all duration-150 ease-out ${
            visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{question.question}</h3>

          {question.type === "single_select" ? (
            <div className="mt-5 space-y-2">
              {question.options.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => answerAndAdvance(opt)}
                  disabled={phase === "submitting"}
                  className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-700 px-4 py-3 text-left text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:opacity-50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-neutral-300 text-xs text-neutral-400 dark:border-neutral-600">
                    {i + 1}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <ShortTextQuestion
              key={question.id}
              initialValue={answers[question.id] ?? ""}
              placeholder={question.placeholder}
              isLast={isLast}
              submitting={phase === "submitting"}
              onAdvance={answerAndAdvance}
            />
          )}

          {error && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
