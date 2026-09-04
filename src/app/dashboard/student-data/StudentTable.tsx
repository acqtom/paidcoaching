"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CEO_QUESTIONS, CMO_QUESTIONS, type TypeformQuestion } from "@/lib/intake-forms";
import type { Student } from "./page";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function StudentTable({ students }: { students: Student[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [viewing, setViewing] = useState<Student | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 shadow-lg shadow-neutral-300/40 dark:shadow-black/50">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300/60 dark:border-neutral-700">
              <th className="px-5 py-3 font-semibold text-neutral-700 dark:text-neutral-300">Student</th>
              <th className="px-5 py-3 font-semibold text-neutral-700 dark:text-neutral-300">Email</th>
              <th className="px-5 py-3 font-semibold text-neutral-700 dark:text-neutral-300">Joined</th>
              <th className="px-5 py-3 font-semibold text-neutral-700 dark:text-neutral-300">Ends</th>
              <th className="px-5 py-3 font-semibold text-neutral-700 dark:text-neutral-300">Progress</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const avatarUrl = s.avatar_path
                ? supabase.storage.from("avatars").getPublicUrl(s.avatar_path).data.publicUrl
                : null;
              return (
                <tr key={s.id} className="border-b border-neutral-300/40 last:border-0 dark:border-neutral-700/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-300 text-xs font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                          {(s.full_name || s.username)[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                          {s.full_name || "—"}
                        </p>
                        <p className="truncate text-xs text-neutral-500">@{s.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-neutral-500">{s.email}</td>
                  <td className="px-5 py-3 text-neutral-500">{fmtDate(s.created_at)}</td>
                  <td className="px-5 py-3 text-neutral-500">{fmtDate(s.end_date)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-300/60 dark:bg-neutral-700">
                        <div
                          className="h-1.5 rounded-full bg-indigo-500"
                          style={{ width: `${s.progress_pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-500">{Math.round(s.progress_pct)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setViewing(s)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <FileText size={13} />
                      View Form Submission
                    </button>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-neutral-400">
                  No students yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && <SubmissionModal student={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function SubmissionModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<"cmo" | "ceo">("cmo");
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  // Which (student, form) pair `answers` was actually fetched for -- lets
  // `loading` be derived (true whenever the key we want doesn't match
  // what's loaded yet) instead of set directly inside the effect below.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${student.id}:${form}`;
  const loading = loadedKey !== key;

  const questions: TypeformQuestion[] = form === "cmo" ? CMO_QUESTIONS : CEO_QUESTIONS;

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("intake_form_submissions")
      .select("answers")
      .eq("user_id", student.id)
      .eq("form", form)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setAnswers((data?.answers as Record<string, string>) ?? null);
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, student.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{student.full_name || `@${student.username}`}</h2>
            <p className="text-xs text-neutral-500">@{student.username}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 p-1">
          {(["cmo", "ceo"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setForm(f)}
              className={
                form === f
                  ? "rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-1.5 text-sm font-medium text-white dark:text-neutral-900"
                  : "rounded-md px-4 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : questions.length === 0 ? (
            <p className="text-sm text-neutral-400">This form doesn&apos;t have any questions yet.</p>
          ) : !answers ? (
            <p className="text-sm text-neutral-400">Not submitted yet.</p>
          ) : (
            questions.map((q) => (
              <div key={q.id}>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{q.question}</p>
                <p className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">
                  {answers[q.id] ?? <span className="text-neutral-400">Skipped</span>}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
