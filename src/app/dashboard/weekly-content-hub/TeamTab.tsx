"use client";

import { useState } from "react";
import { STAGES, Stage, TeamMember, makeId } from "./types";

interface Props {
  teamMembers: TeamMember[];
  accessCode: string;
  onChange: (teamMembers: TeamMember[]) => void;
}

export default function TeamTab({ teamMembers, accessCode, onChange }: Props) {
  const [name, setName] = useState("");
  const [stage, setStage] = useState<Stage>(STAGES[0].id);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(accessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  }

  function addMember(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const member: TeamMember = { id: makeId(), name: trimmed, stage, createdAt: Date.now() };
    onChange([...teamMembers, member]);
    setName("");
  }

  function deleteMember(id: string) {
    onChange(teamMembers.filter((m) => m.id !== id));
  }

  function stageLabel(id: Stage) {
    return STAGES.find((s) => s.id === id)?.label ?? id;
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6 border border-gray-200 rounded-xl p-4 bg-gray-50">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Team Secret Key
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Share this key with your team. Anyone who enters it at{" "}
          <span className="font-medium text-gray-700">/team-access</span> gets full access to this
          board &mdash; no account needed.
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-semibold tracking-[0.3em] bg-white border border-gray-300 rounded-lg px-3 py-1.5">
            {accessCode || "…"}
          </span>
          <button
            onClick={copyCode}
            disabled={!accessCode}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 disabled:opacity-40"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Team Member</h2>

      <form onSubmit={addMember} className="flex items-center gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name…"
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
        />
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as Stage)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-gray-400 bg-white"
        >
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="text-sm font-medium bg-gray-900 text-white rounded-lg px-4 py-2 hover:opacity-90"
        >
          Save
        </button>
      </form>

      {teamMembers.length === 0 ? (
        <p className="text-sm text-gray-400">No team members added yet.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-200">
              <th className="py-2 pr-4 font-semibold">Name</th>
              <th className="py-2 pr-4 font-semibold">Responsible for</th>
              <th className="py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((m) => (
              <tr key={m.id} className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-900">{m.name}</td>
                <td className="py-2 pr-4 text-gray-600">{stageLabel(m.stage)}</td>
                <td className="py-2">
                  <button
                    onClick={() => deleteMember(m.id)}
                    className="text-gray-300 hover:text-red-500 text-xs"
                    title="Remove"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
