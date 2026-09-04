"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

export type Board = { id: string; name: string; access_code: string | null; created_at: string };

// Shared across both places a board can be picked (Sales Board and
// Metrics Tracking) via the same key, so switching boards on one page
// carries over as the default the next time you visit the other --
// boards are the same underlying `sales_boards` rows either way
// (0023_multi_sales_boards.sql), just viewed through two different
// ported apps.
const LAST_BOARD_KEY = "student-hub:last-sales-board-id";

// Admin-only multi-board picker + "Add board" flow, sitting above the
// iframe on both /dashboard/sales-board and /dashboard/tracking.
// `buildIframeSrc` is the only thing that differs between the two --
// which ported app to point at and which query params it expects.
export function BoardSwitcher({
  iframeTitle,
  buildIframeSrc,
  emptyMessage,
}: {
  iframeTitle: string;
  buildIframeSrc: (board: Board) => string;
  emptyMessage: string;
}) {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/sales-boards");
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      const list: Board[] = json.boards ?? [];
      setBoards(list);
      const lastId = window.localStorage.getItem(LAST_BOARD_KEY);
      setSelectedId(list.find((b) => b.id === lastId)?.id ?? list[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectBoard(id: string) {
    setSelectedId(id);
    window.localStorage.setItem(LAST_BOARD_KEY, id);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/sales-boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok || !json.board) {
      setError(json.error ?? "Couldn't create board — try again.");
      return;
    }
    setBoards((prev) => [...(prev ?? []), json.board]);
    selectBoard(json.board.id);
    setNewName("");
    setAdding(false);
  }

  if (boards === null) {
    return <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">Loading…</div>;
  }

  const selectedBoard = boards.find((b) => b.id === selectedId) ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-6 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
        {boards.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => selectBoard(b.id)}
            className={
              b.id === selectedId
                ? "shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }
          >
            {b.name}
          </button>
        ))}
        {adding ? (
          <form onSubmit={handleCreate} className="flex shrink-0 items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Board name"
              className="w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {saving ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <Plus size={14} />
            Add board
          </button>
        )}
        {error && <p className="shrink-0 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>

      {selectedBoard ? (
        <iframe
          key={selectedBoard.id}
          src={buildIframeSrc(selectedBoard)}
          title={iframeTitle}
          className="flex-1 w-full border-0"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-neutral-400">
          {emptyMessage}
        </div>
      )}
    </>
  );
}
