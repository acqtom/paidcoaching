"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Link2, Pencil, Play, Plus, Trash2, Video, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getVideoEmbedUrl } from "@/lib/sop-types";
import type { SopDetailData, SopLesson, SopSubcategory } from "@/lib/sop-types";

type LessonEditorState = {
  subcategoryId: string;
  lessonId: string | null;
  initial: { title: string; video_url: string };
};

function LessonEditorModal({
  isNew,
  initial,
  onSave,
  onClose,
}: {
  isNew: boolean;
  initial: { title: string; video_url: string };
  onSave: (values: { title: string; video_url: string }) => Promise<boolean>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [videoUrl, setVideoUrl] = useState(initial.video_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setSaving(true);
    setError(null);
    const ok = await onSave({ title: trimmedTitle, video_url: videoUrl.trim() });
    setSaving(false);
    if (!ok) {
      setError("Couldn't save — try again.");
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">{isNew ? "New Lesson" : "Edit Lesson"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Title</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Video link (Loom or YouTube)</span>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://loom.com/share/…"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
            />
          </label>
          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function SopDetail({
  sop,
  departmentSlug,
  isAdmin,
}: {
  sop: SopDetailData;
  departmentSlug: string;
  isAdmin: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();

  const savedMetaRef = useRef({ title: sop.title, description: sop.description });
  const [sopTitle, setSopTitle] = useState(sop.title);
  const [sopDescription, setSopDescription] = useState(sop.description);
  const [editingMeta, setEditingMeta] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [subcategories, setSubcategories] = useState<SopSubcategory[]>(sop.subcategories);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    sop.subcategories[0]?.lessons[0]?.id ?? null
  );

  const [addingSubcategory, setAddingSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [savingSubcategory, setSavingSubcategory] = useState(false);

  const [lessonEditor, setLessonEditor] = useState<LessonEditorState | null>(null);

  // The big paste-anything block under a lesson's video, and its
  // per-lesson resource links -- both reset whenever the selected
  // lesson changes, via the explicit resets next to every place below
  // that changes selectedLessonId (rather than a useEffect keyed on it).
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState("");
  const [savingContent, setSavingContent] = useState(false);

  const [addingResource, setAddingResource] = useState(false);
  const [newResourceTitle, setNewResourceTitle] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [savingResource, setSavingResource] = useState(false);

  const selected: SopLesson | undefined = subcategories
    .flatMap((c) => c.lessons)
    .find((l) => l.id === selectedLessonId);

  function selectLesson(id: string | null) {
    setSelectedLessonId(id);
    setEditingContent(false);
    setAddingResource(false);
  }

  function updateLessonInState(lessonId: string, updater: (lesson: SopLesson) => SopLesson) {
    setSubcategories((prev) =>
      prev.map((c) => ({ ...c, lessons: c.lessons.map((l) => (l.id === lessonId ? updater(l) : l)) }))
    );
  }

  async function handleSaveMeta(e: React.FormEvent) {
    e.preventDefault();
    const title = sopTitle.trim();
    if (!title) return;
    setSavingMeta(true);
    setMetaError(null);
    const { data, error } = await supabase
      .from("sops")
      .update({ title, description: sopDescription.trim() })
      .eq("id", sop.id)
      .select("title, description")
      .single();
    setSavingMeta(false);
    if (error || !data) {
      setMetaError("Couldn't save — try again.");
      return;
    }
    savedMetaRef.current = { title: data.title, description: data.description };
    setSopTitle(data.title);
    setSopDescription(data.description);
    setEditingMeta(false);
  }

  function handleCancelMeta() {
    setSopTitle(savedMetaRef.current.title);
    setSopDescription(savedMetaRef.current.description);
    setMetaError(null);
    setEditingMeta(false);
  }

  async function handleDeleteSop() {
    if (!window.confirm("Delete this SOP and everything in it? This can't be undone.")) return;
    const { data, error } = await supabase.from("sops").delete().eq("id", sop.id).select("id");
    if (error || !data || data.length === 0) return;
    router.push(`/dashboard/sops/${departmentSlug}`);
  }

  async function handleAddSubcategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newSubcategoryName.trim();
    if (!name) return;
    setSavingSubcategory(true);
    const { data, error } = await supabase
      .from("sop_subcategories")
      .insert({ sop_id: sop.id, name, position: subcategories.length })
      .select("id, name, position")
      .single();
    setSavingSubcategory(false);
    if (error || !data) return;
    setSubcategories((prev) => [...prev, { ...data, lessons: [] }]);
    setNewSubcategoryName("");
    setAddingSubcategory(false);
  }

  async function handleDeleteSubcategory(id: string) {
    if (!window.confirm("Delete this category and its lessons?")) return;
    const previous = subcategories;
    const removed = subcategories.find((c) => c.id === id);
    setSubcategories((prev) => prev.filter((c) => c.id !== id));
    if (removed?.lessons.some((l) => l.id === selectedLessonId)) selectLesson(null);
    const { data, error } = await supabase.from("sop_subcategories").delete().eq("id", id).select("id");
    if (error || !data || data.length === 0) setSubcategories(previous);
  }

  async function handleSaveLesson(
    subcategoryId: string,
    lessonId: string | null,
    values: { title: string; video_url: string }
  ): Promise<boolean> {
    if (lessonId) {
      const { data, error } = await supabase
        .from("sop_lessons")
        .update({ title: values.title, video_url: values.video_url || null })
        .eq("id", lessonId)
        .select("id, title, video_url")
        .single();
      if (error || !data) return false;
      updateLessonInState(lessonId, (l) => ({ ...l, title: data.title, video_url: data.video_url }));
      return true;
    }
    const category = subcategories.find((c) => c.id === subcategoryId);
    const { data, error } = await supabase
      .from("sop_lessons")
      .insert({
        subcategory_id: subcategoryId,
        title: values.title,
        video_url: values.video_url || null,
        position: category?.lessons.length ?? 0,
      })
      .select("id, title, video_url, content, position")
      .single();
    if (error || !data) return false;
    const newLesson: SopLesson = { ...data, resources: [] };
    setSubcategories((prev) => prev.map((c) => (c.id === subcategoryId ? { ...c, lessons: [...c.lessons, newLesson] } : c)));
    selectLesson(data.id);
    return true;
  }

  async function handleDeleteLesson(subcategoryId: string, lessonId: string) {
    const previous = subcategories;
    setSubcategories((prev) =>
      prev.map((c) => (c.id === subcategoryId ? { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) } : c))
    );
    if (selectedLessonId === lessonId) selectLesson(null);
    const { data, error } = await supabase.from("sop_lessons").delete().eq("id", lessonId).select("id");
    if (error || !data || data.length === 0) setSubcategories(previous);
  }

  function startEditingContent() {
    setContentDraft(selected?.content ?? "");
    setEditingContent(true);
  }

  async function handleSaveContent() {
    if (!selected) return;
    setSavingContent(true);
    const { data, error } = await supabase
      .from("sop_lessons")
      .update({ content: contentDraft.trim() || null })
      .eq("id", selected.id)
      .select("content")
      .single();
    setSavingContent(false);
    if (error || !data) return;
    updateLessonInState(selected.id, (l) => ({ ...l, content: data.content }));
    setEditingContent(false);
  }

  async function handleAddResource(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const title = newResourceTitle.trim();
    const url = newResourceUrl.trim();
    if (!title || !url) return;
    setSavingResource(true);
    const { data, error } = await supabase
      .from("sop_lesson_resources")
      .insert({ lesson_id: selected.id, title, url, position: selected.resources.length })
      .select("id, title, url, position")
      .single();
    setSavingResource(false);
    if (error || !data) return;
    updateLessonInState(selected.id, (l) => ({ ...l, resources: [...l.resources, data] }));
    setNewResourceTitle("");
    setNewResourceUrl("");
    setAddingResource(false);
  }

  async function handleDeleteResource(resourceId: string) {
    if (!selected) return;
    const lessonId = selected.id;
    const previous = subcategories;
    updateLessonInState(lessonId, (l) => ({ ...l, resources: l.resources.filter((r) => r.id !== resourceId) }));
    const { data, error } = await supabase.from("sop_lesson_resources").delete().eq("id", resourceId).select("id");
    if (error || !data || data.length === 0) setSubcategories(previous);
  }

  const embedUrl = selected?.video_url ? getVideoEmbedUrl(selected.video_url) : null;

  return (
    <div>
      {editingMeta ? (
        <form onSubmit={handleSaveMeta} className="max-w-xl space-y-2">
          <input
            autoFocus
            value={sopTitle}
            onChange={(e) => setSopTitle(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xl font-semibold outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
          />
          <textarea
            value={sopDescription}
            onChange={(e) => setSopDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
          />
          {metaError && <p className="text-xs text-rose-600 dark:text-rose-400">{metaError}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={savingMeta || !sopTitle.trim()}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {savingMeta ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancelMeta}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{sopTitle}</h1>
            <p className="mt-1 text-sm text-neutral-500">{sopDescription}</p>
          </div>
          {isAdmin && (
            <div className="flex shrink-0 items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditingMeta(true)}
                title="Edit SOP details"
                className="inline-flex text-neutral-400 hover:text-indigo-500"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={handleDeleteSop}
                title="Delete this SOP"
                className="inline-flex text-neutral-400 hover:text-rose-500"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          {subcategories.map((category) => (
            <div key={category.id} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{category.name}</p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSubcategory(category.id)}
                    title="Delete category"
                    className="inline-flex text-neutral-300 hover:text-rose-500 dark:text-neutral-600"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {category.lessons.map((lesson) => {
                  const isSelected = selected?.id === lesson.id;
                  const Icon = lesson.video_url ? Video : FileText;
                  return (
                    <div key={lesson.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => selectLesson(lesson.id)}
                        className={
                          isSelected
                            ? "flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 px-2 py-2 text-left text-sm font-medium text-white dark:text-neutral-900"
                            : "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        }
                      >
                        <Icon size={14} className="shrink-0" />
                        <span className="truncate">{lesson.title}</span>
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setLessonEditor({
                                subcategoryId: category.id,
                                lessonId: lesson.id,
                                initial: {
                                  title: lesson.title,
                                  video_url: lesson.video_url ?? "",
                                },
                              })
                            }
                            title="Edit lesson"
                            className="inline-flex shrink-0 text-neutral-300 hover:text-indigo-500 dark:text-neutral-600"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLesson(category.id, lesson.id)}
                            title="Delete lesson"
                            className="inline-flex shrink-0 text-neutral-300 hover:text-rose-500 dark:text-neutral-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() =>
                      setLessonEditor({
                        subcategoryId: category.id,
                        lessonId: null,
                        initial: { title: "", video_url: "" },
                      })
                    }
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Plus size={14} className="shrink-0" />
                    Add lesson
                  </button>
                )}
              </div>
            </div>
          ))}

          {isAdmin &&
            (addingSubcategory ? (
              <form onSubmit={handleAddSubcategory} className="mt-2 space-y-1.5">
                <input
                  autoFocus
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  placeholder="Category name"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={savingSubcategory || !newSubcategoryName.trim()}
                    className="flex-1 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                  >
                    {savingSubcategory ? "Adding…" : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingSubcategory(false);
                      setNewSubcategoryName("");
                    }}
                    className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingSubcategory(true)}
                className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-2 py-2 text-left text-sm font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Plus size={14} className="shrink-0" />
                Add sub category
              </button>
            ))}
        </aside>

        <div>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={selected?.title ?? "Lesson video"}
              className="aspect-video w-full rounded-2xl"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : selected?.video_url ? (
            <a
              href={selected.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl bg-black text-neutral-400 hover:text-white"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <Play size={22} className="ml-0.5 text-white" fill="currentColor" />
              </span>
              <span className="text-sm">Watch video ↗</span>
            </a>
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl bg-black text-neutral-400">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <Play size={22} className="ml-0.5 text-white" fill="currentColor" />
              </span>
              <span className="text-sm">{selected ? "No video linked yet" : "Select a lesson"}</span>
            </div>
          )}

          <div className="mt-6">
            <h2 className="text-lg font-semibold">{selected?.title ?? "Select a lesson"}</h2>
          </div>

          {selected && (isAdmin || selected.content) && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Content</p>
                {isAdmin && !editingContent && (
                  <button
                    type="button"
                    onClick={startEditingContent}
                    title="Edit content"
                    className="inline-flex text-neutral-400 hover:text-indigo-500"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
              {editingContent ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    autoFocus
                    value={contentDraft}
                    onChange={(e) => setContentDraft(e.target.value)}
                    rows={14}
                    placeholder="Paste anything you need here…"
                    className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveContent}
                      disabled={savingContent}
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      {savingContent ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingContent(false)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : selected.content ? (
                <div className="mt-2 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
                  <p className="whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">
                    {selected.content}
                  </p>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 p-4">
                  <p className="text-sm italic text-neutral-400">Nothing here yet — click the pencil to add content.</p>
                </div>
              )}
            </div>
          )}

          {selected && (isAdmin || selected.resources.length > 0) && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Resources</p>
              <div className="mt-2 space-y-1.5">
                {selected.resources.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      <Link2 size={13} className="shrink-0" />
                      <span className="truncate">{r.title}</span>
                    </a>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteResource(r.id)}
                        title="Delete link"
                        className="inline-flex shrink-0 text-neutral-300 hover:text-rose-500 dark:text-neutral-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {selected.resources.length === 0 && (
                  <p className="text-sm text-neutral-400">No resources yet.</p>
                )}
              </div>
              {isAdmin &&
                (addingResource ? (
                  <form onSubmit={handleAddResource} className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      autoFocus
                      value={newResourceTitle}
                      onChange={(e) => setNewResourceTitle(e.target.value)}
                      placeholder="Title"
                      className="w-36 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
                    />
                    <input
                      type="url"
                      value={newResourceUrl}
                      onChange={(e) => setNewResourceUrl(e.target.value)}
                      placeholder="https://…"
                      className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
                    />
                    <button
                      type="submit"
                      disabled={savingResource || !newResourceTitle.trim() || !newResourceUrl.trim()}
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      {savingResource ? "Adding…" : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingResource(false);
                        setNewResourceTitle("");
                        setNewResourceUrl("");
                      }}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingResource(true)}
                    className="mt-2 flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <Plus size={14} />
                    Add link
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {lessonEditor && (
        <LessonEditorModal
          isNew={lessonEditor.lessonId === null}
          initial={lessonEditor.initial}
          onSave={(values) => handleSaveLesson(lessonEditor.subcategoryId, lessonEditor.lessonId, values)}
          onClose={() => setLessonEditor(null)}
        />
      )}
    </div>
  );
}
