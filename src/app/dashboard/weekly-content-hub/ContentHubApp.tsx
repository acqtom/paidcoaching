"use client";

import { useEffect, useRef, useState } from "react";
import { ContentHubState, defaultContentHubState } from "./types";
import KanbanBoard from "./KanbanBoard";
import ContentDocs from "./ContentDocs";
import TeamTab from "./TeamTab";

const POLL_INTERVAL_MS = 5000;
const SAVE_DEBOUNCE_MS = 600;

type Tab = "kanban" | "content" | "team";
type Props = { mode: "owner" } | { mode: "code"; code: string };

export default function ContentHubApp(props: Props) {
  const apiUrl =
    props.mode === "owner"
      ? "/api/content-hub/state"
      : `/api/content-hub/by-code?code=${encodeURIComponent(props.code)}`;

  const [state, setState] = useState<ContentHubState | null>(null);
  const [tab, setTab] = useState<Tab>("kanban");
  const [syncStatus, setSyncStatus] = useState("Loading…");
  const [loadError, setLoadError] = useState<string | null>(null);

  const stateRef = useRef<ContentHubState | null>(null);
  const lastEditAt = useRef(0);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "load failed: " + res.status);
        }
        const data = await res.json();
        if (cancelled) return;
        setState({
          kanban: Array.isArray(data.kanban) ? data.kanban : [],
          documents:
            Array.isArray(data.documents) && data.documents.length
              ? data.documents
              : defaultContentHubState().documents,
          teamMembers: Array.isArray(data.teamMembers) ? data.teamMembers : [],
          accessCode: data.accessCode || "",
          updatedAt: data.updatedAt || 0,
        });
        setSyncStatus("Synced");
      } catch (e) {
        console.error("Content hub load failed:", e);
        if (!cancelled) {
          if (props.mode === "code") {
            setLoadError(e instanceof Error ? e.message : "Failed to load");
          } else {
            setState(defaultContentHubState());
          }
          setSyncStatus("Sync error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (!stateRef.current) return;
      if (Date.now() - lastEditAt.current < POLL_INTERVAL_MS / 2) return;
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) return;
        const data = await res.json();
        if (!stateRef.current) return;
        if (data.updatedAt && data.updatedAt > stateRef.current.updatedAt) {
          setState({
            kanban: Array.isArray(data.kanban) ? data.kanban : [],
            documents:
              Array.isArray(data.documents) && data.documents.length
                ? data.documents
                : stateRef.current.documents,
            teamMembers: Array.isArray(data.teamMembers) ? data.teamMembers : [],
            accessCode: data.accessCode || stateRef.current.accessCode,
            updatedAt: data.updatedAt,
          });
          setSyncStatus("Synced");
        }
      } catch (e) {
        console.error("Content hub poll failed:", e);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [apiUrl]);

  function scheduleSave(next: ContentHubState) {
    lastEditAt.current = Date.now();
    setState(next);
    setSyncStatus("Saving…");
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) throw new Error("save failed: " + res.status);
        const saved = await res.json();
        setState((prev) => ({
          kanban: saved.kanban,
          documents: saved.documents,
          teamMembers: saved.teamMembers,
          accessCode: saved.accessCode || prev?.accessCode || "",
          updatedAt: saved.updatedAt,
        }));
        setSyncStatus("Synced");
      } catch (e) {
        console.error("Content hub save failed:", e);
        setSyncStatus("Sync error");
      }
    }, SAVE_DEBOUNCE_MS);
  }

  if (loadError) {
    return (
      <div className="max-w-[1600px] mx-auto px-8 py-10 text-sm text-gray-500">
        {loadError}
      </div>
    );
  }

  if (!state) {
    return <div className="max-w-[1600px] mx-auto px-8 py-10 text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex rounded-full bg-gray-100 p-1">
          <button
            onClick={() => setTab("kanban")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === "kanban" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Kanban Board
          </button>
          <button
            onClick={() => setTab("content")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === "content" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Content
          </button>
          <button
            onClick={() => setTab("team")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === "team" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Team
          </button>
        </div>
        <span className="text-xs text-gray-400 tabular-nums">{syncStatus}</span>
      </div>

      {tab === "kanban" && (
        <KanbanBoard
          cards={state.kanban}
          teamMembers={state.teamMembers}
          onChange={(kanban) => scheduleSave({ ...state, kanban })}
        />
      )}
      {tab === "content" && (
        <ContentDocs
          documents={state.documents}
          onChange={(documents) => scheduleSave({ ...state, documents })}
        />
      )}
      {tab === "team" && (
        <TeamTab
          teamMembers={state.teamMembers}
          accessCode={state.accessCode}
          onChange={(teamMembers) => scheduleSave({ ...state, teamMembers })}
        />
      )}
    </div>
  );
}
