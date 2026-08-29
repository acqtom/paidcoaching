"use client";

import { useState } from "react";
import { FileText, Play, Video } from "lucide-react";
import type { Sop } from "@/lib/sops";

export function SopDetail({ sop }: { sop: Sop }) {
  const firstLesson = sop.categories[0]?.lessons[0];
  const [selected, setSelected] = useState(firstLesson);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
        {sop.categories.map((category) => (
          <div key={category.name} className="mb-4 last:mb-0">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {category.name}
            </p>
            <div className="mt-1 space-y-0.5">
              {category.lessons.map((lesson) => {
                const isSelected = selected?.slug === lesson.slug;
                const Icon = lesson.type === "pdf" ? FileText : Video;
                return (
                  <button
                    key={lesson.slug}
                    type="button"
                    onClick={() => setSelected(lesson)}
                    className={
                      isSelected
                        ? "flex w-full items-center gap-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 px-2 py-2 text-left text-sm font-medium text-white dark:text-neutral-900"
                        : "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }
                  >
                    <Icon size={14} className="shrink-0" />
                    {lesson.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </aside>

      <div>
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl bg-black text-neutral-400">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
            <Play size={22} className="ml-0.5 text-white" fill="currentColor" />
          </span>
          <span className="text-sm">Loom video placeholder</span>
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-semibold">
            {selected?.title ?? "Select a lesson"}
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Content and notes for this lesson go here.
          </p>
        </div>
      </div>
    </div>
  );
}
