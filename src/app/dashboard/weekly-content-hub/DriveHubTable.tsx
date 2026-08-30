"use client";

import { DriveHubSection } from "./types";

interface Props {
  sections: DriveHubSection[];
  onChange: (sections: DriveHubSection[]) => void;
}

export default function DriveHubTable({ sections, onChange }: Props) {
  function updateRow(sectionId: string, rowId: string, linkLabel: string) {
    onChange(
      sections.map((s) =>
        s.id === sectionId
          ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, linkLabel } : r)) }
          : s
      )
    );
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">
        Folder names only for now &mdash; actual Drive links come in a later pass.
      </p>
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.id} className="max-w-md border border-gray-700 rounded overflow-hidden">
            <div className="bg-blue-200 text-center font-bold text-sm py-2 border-b border-gray-700">
              {section.title}
            </div>
            {section.rows.map((row) => (
              <div key={row.id} className="flex border-b border-gray-700 last:border-b-0 text-sm">
                <div className="w-1/2 px-3 py-2 border-r border-gray-700 bg-white text-gray-800">
                  {row.label}
                </div>
                <div className="w-1/2 px-3 py-2 bg-amber-100 flex items-center gap-1.5">
                  <span className="shrink-0">📁</span>
                  <input
                    value={row.linkLabel}
                    onChange={(e) => updateRow(section.id, row.id, e.target.value)}
                    className="bg-transparent outline-none flex-1 min-w-0 text-gray-800 underline decoration-dotted decoration-gray-400"
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
