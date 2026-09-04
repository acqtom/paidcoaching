"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CEO_QUESTIONS, CMO_QUESTIONS, type TypeformQuestion } from "@/lib/intake-forms";
import type { Student } from "./page";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// Overdue means there's a due date in the past (or today) that hasn't
// been marked paid yet -- not just "amount_due > 0", since a due date
// might be set for the future while a balance is still outstanding.
function isOverdue(s: Student): boolean {
  if (!s.due_date || s.paid) return false;
  const todayISO = new Date().toISOString().slice(0, 10);
  return s.due_date <= todayISO;
}

export function StudentTable({ students: initialStudents }: { students: Student[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [students, setStudents] = useState(initialStudents);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [editingPayment, setEditingPayment] = useState<Student | null>(null);

  function handlePaymentSaved(updated: Student) {
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingPayment(null);
  }

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
              <th className="px-5 py-3 font-semibold text-neutral-700 dark:text-neutral-300">Payment</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const avatarUrl = s.avatar_path
                ? supabase.storage.from("avatars").getPublicUrl(s.avatar_path).data.publicUrl
                : null;
              const overdue = isOverdue(s);
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
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setEditingPayment(s)}
                      className={
                        overdue
                          ? "inline-flex items-center gap-1.5 rounded-lg border border-rose-400 bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-200 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-400 dark:hover:bg-rose-500/25"
                          : "inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }
                    >
                      {s.due_date
                        ? `${fmtUSD(s.amount_due)} due ${fmtDate(s.due_date)}`
                        : s.amount_paid_upfront > 0
                          ? `${fmtUSD(s.amount_paid_upfront)} paid`
                          : "Set payment"}
                    </button>
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
                <td colSpan={7} className="px-5 py-6 text-center text-neutral-400">
                  No students yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && <SubmissionModal student={viewing} onClose={() => setViewing(null)} />}
      {editingPayment && (
        <PaymentModal student={editingPayment} onClose={() => setEditingPayment(null)} onSaved={handlePaymentSaved} />
      )}
    </>
  );
}

function PaymentModal({
  student,
  onClose,
  onSaved,
}: {
  student: Student;
  onClose: () => void;
  onSaved: (updated: Student) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [amountPaidUpfront, setAmountPaidUpfront] = useState(String(student.amount_paid_upfront || ""));
  const [amountDue, setAmountDue] = useState(String(student.amount_due || ""));
  const [dueDate, setDueDate] = useState(student.due_date ?? "");
  const [paid, setPaid] = useState(student.paid);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data, error: upsertError } = await supabase
      .from("student_payments")
      .upsert(
        {
          user_id: student.id,
          amount_paid_upfront: Number(amountPaidUpfront) || 0,
          amount_due: Number(amountDue) || 0,
          due_date: dueDate || null,
          paid,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("amount_paid_upfront, amount_due, due_date, paid")
      .single();
    setSaving(false);
    if (upsertError || !data) {
      setError("Couldn't save — try again.");
      return;
    }
    onSaved({ ...student, ...data });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Payment</h2>
            <p className="text-xs text-neutral-500">{student.full_name || `@${student.username}`}</p>
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

        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Amount paid upfront ($)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountPaidUpfront}
              onChange={(e) => setAmountPaidUpfront(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Amount due ($)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              Paid — clears the overdue flag regardless of due date
            </span>
          </label>

          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

function SubmissionModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<"cmo" | "ceo">("cmo");
  const [answers, setAnswers] = useState<Record<string, string | string[]> | null>(null);
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
        setAnswers((data?.answers as Record<string, string | string[]>) ?? null);
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
            questions.map((q) => {
              const a = answers[q.id];
              const display = Array.isArray(a) ? a.join(", ") : a;
              return (
                <div key={q.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{q.question}</p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">
                    {display || <span className="text-neutral-400">Skipped</span>}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
