"use client";

import { useState } from "react";
import { ContentDoc, DriveHubSection, makeId } from "./types";
import DriveHubTable from "./DriveHubTable";

interface Props {
  documents: ContentDoc[];
  onChange: (documents: ContentDoc[]) => void;
}

export default function ContentDocs({ documents, onChange }: Props) {
  const sorted = [...documents].sort((a, b) => a.position - b.position);
  const [selectedId, setSelectedId] = useState<string | null>(sorted[0]?.id ?? null);
  const selected = documents.find((d) => d.id === selectedId) ?? sorted[0] ?? null;

  function addDoc() {
    const doc: ContentDoc = {
      id: makeId(),
      title: "Untitled",
      body: "",
      position: documents.length,
      createdAt: Date.now(),
    };
    onChange([...documents, doc]);
    setSelectedId(doc.id);
  }

  function updateDoc(id: string, patch: Partial<ContentDoc>) {
    onChange(documents.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function updateDriveHub(id: string, sections: DriveHubSection[]) {
    updateDoc(id, { driveHub: sections });
  }

  function deleteDoc(id: string) {
    const next = documents.filter((d) => d.id !== id);
    onChange(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }

  return (
    <div className="flex gap-6">
      <div className="w-64 flex-none border-r border-gray-200 pr-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Document tabs</h3>
          <button
            onClick={addDoc}
            className="text-gray-400 hover:text-gray-700 text-base leading-none"
            title="New document"
          >
            +
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {sorted.map((doc) => {
            const active = selected?.id === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedId(doc.id)}
                className={`group flex items-center justify-between gap-2 text-sm px-2.5 py-1.5 rounded-lg cursor-pointer ${
                  active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="truncate">{doc.title || "Untitled"}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDoc(doc.id);
                  }}
                  className={`shrink-0 opacity-0 group-hover:opacity-100 text-xs ${
                    active ? "text-gray-300 hover:text-white" : "text-gray-300 hover:text-red-500"
                  }`}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {selected ? (
          <div className="flex flex-col">
            <input
              value={selected.title}
              onChange={(e) => updateDoc(selected.id, { title: e.target.value })}
              placeholder="Untitled"
              className="text-lg font-semibold text-gray-900 outline-none mb-3 bg-transparent"
            />
            {selected.driveHub ? (
              <DriveHubTable
                sections={selected.driveHub}
                onChange={(sections) => updateDriveHub(selected.id, sections)}
              />
            ) : (
              <textarea
                value={selected.body}
                onChange={(e) => updateDoc(selected.id, { body: e.target.value })}
                placeholder="Start writing…"
                className="min-h-[480px] w-full text-sm text-gray-800 leading-relaxed outline-none resize-none border border-gray-200 rounded-xl p-4 focus:border-gray-300"
              />
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No document selected. Click &ldquo;+&rdquo; to create one.</div>
        )}
      </div>
    </div>
  );
}
