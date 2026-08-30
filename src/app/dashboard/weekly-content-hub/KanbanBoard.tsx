"use client";

import { useState } from "react";
import { STAGES, Stage, KanbanCard, TeamMember, Priority, PRIORITIES, makeId } from "./types";

interface Props {
  cards: KanbanCard[];
  teamMembers: TeamMember[];
  onChange: (cards: KanbanCard[]) => void;
}

const PRIORITY_STYLES: Record<Priority, string> = {
  high: "bg-red-50 text-red-600",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-gray-100 text-gray-500",
};

const DEFAULT_PRIORITY: Priority = "medium";

export default function KanbanBoard({ cards, teamMembers, onChange }: Props) {
  const [addingIn, setAddingIn] = useState<Stage | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPriority, setDraftPriority] = useState<Priority>(DEFAULT_PRIORITY);
  const [dragCardId, setDragCardId] = useState<string | null>(null);

  function cardsFor(stage: Stage) {
    return cards.filter((c) => c.stage === stage).sort((a, b) => a.position - b.position);
  }

  function addCard(stage: Stage, createdAt: number) {
    const title = draftTitle.trim();
    const priority = draftPriority;
    setDraftTitle("");
    setDraftPriority(DEFAULT_PRIORITY);
    setAddingIn(null);
    if (!title) return;
    const newCard: KanbanCard = {
      id: makeId(),
      title,
      notes: "",
      stage,
      priority,
      position: cardsFor(stage).length,
      createdAt,
    };
    onChange([...cards, newCard]);
  }

  function updateCard(id: string, patch: Partial<KanbanCard>) {
    onChange(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteCard(id: string) {
    onChange(cards.filter((c) => c.id !== id));
  }

  function moveCard(id: string, stage: Stage) {
    const moving = cards.find((c) => c.id === id);
    if (!moving || moving.stage === stage) return;
    onChange(cards.map((c) => (c.id === id ? { ...c, stage, position: cardsFor(stage).length } : c)));
  }

  function membersFor(stage: Stage) {
    return teamMembers.filter((m) => m.stage === stage);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map((s) => (
        <div
          key={s.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/plain");
            if (id) moveCard(id, s.id);
            setDragCardId(null);
          }}
          className="flex-none w-72 bg-gray-50 border border-gray-200 rounded-xl p-3"
        >
          <div className="mb-3 px-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">{s.label}</h3>
              <span className="text-xs text-gray-400">{cardsFor(s.id).length}</span>
            </div>
            {membersFor(s.id).length > 0 && (
              <div className="mt-0.5 text-xs text-gray-400 truncate">
                Responsible: {membersFor(s.id).map((m) => m.name).join(", ")}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {cardsFor(s.id).map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", card.id);
                  setDragCardId(card.id);
                }}
                onDragEnd={() => setDragCardId(null)}
                className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing ${
                  dragCardId === card.id ? "opacity-40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <input
                    value={card.title}
                    onChange={(e) => updateCard(card.id, { title: e.target.value })}
                    className="flex-1 min-w-0 text-sm font-medium text-gray-900 outline-none bg-transparent"
                  />
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="shrink-0 text-gray-300 hover:text-red-500 text-xs leading-none"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
                <select
                  value={card.priority ?? DEFAULT_PRIORITY}
                  onChange={(e) => updateCard(card.id, { priority: e.target.value as Priority })}
                  className={`mt-2 text-[11px] font-semibold rounded-full pl-2 pr-1 py-0.5 border-none outline-none cursor-pointer ${
                    PRIORITY_STYLES[card.priority ?? DEFAULT_PRIORITY]
                  }`}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={card.notes}
                  onChange={(e) => updateCard(card.id, { notes: e.target.value })}
                  placeholder="Notes…"
                  rows={2}
                  className="mt-2 w-full text-xs text-gray-500 outline-none bg-transparent resize-none placeholder:text-gray-300"
                />
              </div>
            ))}
          </div>

          {addingIn === s.id ? (
            <div
              className="mt-2 flex flex-col gap-1.5"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) addCard(s.id, Date.now());
              }}
            >
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCard(s.id, Date.now());
                  if (e.key === "Escape") {
                    setAddingIn(null);
                    setDraftTitle("");
                    setDraftPriority(DEFAULT_PRIORITY);
                  }
                }}
                placeholder="Content title…"
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:border-gray-400"
              />
              <select
                value={draftPriority}
                onChange={(e) => setDraftPriority(e.target.value as Priority)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCard(s.id, Date.now());
                  if (e.key === "Escape") {
                    setAddingIn(null);
                    setDraftTitle("");
                    setDraftPriority(DEFAULT_PRIORITY);
                  }
                }}
                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:border-gray-400 bg-white"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} priority
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <button
              onClick={() => setAddingIn(s.id)}
              className="mt-2 w-full text-left text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors"
            >
              + Add card
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
