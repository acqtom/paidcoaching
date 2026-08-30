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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((section) => (
          <div
            key={section.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700">{section.title}</h4>
            </div>
            {section.rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center border-b border-gray-100 last:border-b-0 text-sm"
              >
                <div className="w-1/2 px-4 py-2.5 text-gray-500">{row.label}</div>
                <div className="w-1/2 px-4 py-2.5 border-l border-gray-100 flex items-center gap-1.5">
                  <span className="shrink-0 text-gray-400">📁</span>
                  <input
                    value={row.linkLabel}
                    onChange={(e) => updateRow(section.id, row.id, e.target.value)}
                    className="bg-transparent outline-none flex-1 min-w-0 text-gray-800"
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
