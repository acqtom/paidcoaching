"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SOP_GRADIENTS } from "@/lib/sops";
import type { SopSummary } from "@/lib/sop-types";

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "sop";
}

export function DepartmentSopsGrid({
  departmentSlug,
  sops: initialSops,
  isAdmin,
}: {
  departmentSlug: string;
  sops: SopSummary[];
  isAdmin: boolean;
}) {
  const supabase = createClient();
  const [sops, setSops] = useState(initialSops);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setSaving(true);
    setError(null);
    const baseSlug = slugify(title);
    const gradient = SOP_GRADIENTS[sops.length % SOP_GRADIENTS.length];
    let { data, error: insertError } = await supabase
      .from("sops")
      .insert({
        department_slug: departmentSlug,
        slug: baseSlug,
        title,
        description: newDescription.trim(),
        gradient,
        position: sops.length,
      })
      .select("id, slug, title, description, gradient")
      .single();
    if (insertError?.code === "23505") {
      // Slug already taken in this department -- retry once with a
      // short unique suffix rather than bothering the admin about it.
      ({ data, error: insertError } = await supabase
        .from("sops")
        .insert({
          department_slug: departmentSlug,
          slug: `${baseSlug}-${Date.now().toString(36).slice(-4)}`,
          title,
          description: newDescription.trim(),
          gradient,
          position: sops.length,
        })
        .select("id, slug, title, description, gradient")
        .single());
    }
    setSaving(false);
    if (insertError || !data) {
      setError("Couldn't create that SOP — try again.");
      return;
    }
    setSops((prev) => [...prev, { ...data, subcategoryCount: 0, lessonCount: 0 }]);
    setAdding(false);
    setNewTitle("");
    setNewDescription("");
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this SOP and everything in it? This can't be undone.")) return;
    const previous = sops;
    setSops((prev) => prev.filter((s) => s.id !== id));
    const { data, error: deleteError } = await supabase.from("sops").delete().eq("id", id).select("id");
    if (deleteError || !data || data.length === 0) {
      setSops(previous);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {sops.map((s) => (
        <div key={s.id} className="relative">
          <Link
            href={`/dashboard/sops/${departmentSlug}/${s.slug}`}
            className="block overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg shadow-neutral-300/40 dark:shadow-black/50 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-xl"
          >
            <div className={`aspect-video w-full bg-gradient-to-br ${s.gradient}`} />
            <div className="p-4">
              <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">{s.title}</h2>
              <p className="mt-1 text-sm text-neutral-500">{s.description}</p>
              <p className="mt-3 text-xs text-neutral-400">
                {s.subcategoryCount} {s.subcategoryCount === 1 ? "category" : "categories"} ·{" "}
                {s.lessonCount} {s.lessonCount === 1 ? "lesson" : "lessons"}
              </p>
            </div>
          </Link>
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleDelete(s.id);
              }}
              title="Delete SOP"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-rose-600"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}

      {isAdmin && (
        <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-neutral-400">
          {adding ? (
            <form onSubmit={handleCreate} className="w-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">New SOP</span>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setError(null);
                  }}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                >
                  <X size={14} />
                </button>
              </div>
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:ring-neutral-100"
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:ring-neutral-100"
              />
              {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
              <button
                type="submit"
                disabled={saving || !newTitle.trim()}
                className="w-full rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {saving ? "Creating…" : "Create SOP"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex flex-col items-center gap-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-700">
                <Plus size={18} />
              </span>
              <span className="text-sm font-medium">Add SOP</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
