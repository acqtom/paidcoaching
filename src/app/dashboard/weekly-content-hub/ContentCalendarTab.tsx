"use client";

import { CalendarColumnDef, ContentCalendarState, DAYS_OF_WEEK, makeId } from "./types";

interface Props {
  calendar: ContentCalendarState;
  onChange: (calendar: ContentCalendarState) => void;
}

const DOT_PALETTE = [
  "bg-gray-400",
  "bg-purple-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-blue-400",
  "bg-pink-400",
  "bg-cyan-400",
  "bg-orange-400",
];

export default function ContentCalendarTab({ calendar, onChange }: Props) {
  const columns = calendar.columns;

  function updateCell(day: string, columnId: string, value: string) {
    onChange({
      ...calendar,
      cells: {
        ...calendar.cells,
        [day]: { ...calendar.cells[day], [columnId]: value },
      },
    });
  }

  function renameColumn(columnId: string, label: string) {
    onChange({
      ...calendar,
      columns: columns.map((c) => (c.id === columnId ? { ...c, label } : c)),
    });
  }

  function addColumn() {
    const newCol: CalendarColumnDef = { id: makeId(), label: "New column" };
    onChange({ ...calendar, columns: [...columns, newCol] });
  }

  function deleteColumn(columnId: string) {
    const nextCells: Record<string, Record<string, string>> = {};
    Object.entries(calendar.cells).forEach(([day, row]) => {
      const rest = { ...row };
      delete rest[columnId];
      nextCells[day] = rest;
    });
    onChange({
      columns: columns.filter((c) => c.id !== columnId),
      cells: nextCells,
    });
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">
        Your weekly content rhythm &mdash; the same days repeat every week, not a specific dated schedule.
      </p>
      <div className="overflow-x-auto">
        <div
          className="min-w-[880px] grid gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden"
          style={{ gridTemplateColumns: `120px repeat(${columns.length}, 1fr) 44px` }}
        >
          <div className="bg-gray-50" />
          {columns.map((col, i) => (
            <div key={col.id} className="group bg-gray-50 px-3 py-2.5 flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_PALETTE[i % DOT_PALETTE.length]}`} />
              <input
                value={col.label}
                onChange={(e) => renameColumn(col.id, e.target.value)}
                className="text-xs font-semibold text-gray-600 bg-transparent outline-none min-w-0 flex-1"
              />
              <button
                onClick={() => deleteColumn(col.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-xs"
                title="Remove column"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="bg-gray-50 flex items-center justify-center">
            <button
              onClick={addColumn}
              className="text-gray-400 hover:text-gray-700 text-base leading-none"
              title="Add column"
            >
              +
            </button>
          </div>

          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="contents">
              <div className="bg-white px-3 py-2 flex items-center text-sm font-semibold text-gray-700">
                {day}
              </div>
              {columns.map((col) => (
                <div key={col.id} className="bg-white p-1">
                  <textarea
                    value={calendar.cells[day]?.[col.id] ?? ""}
                    onChange={(e) => updateCell(day, col.id, e.target.value)}
                    rows={2}
                    className="w-full text-sm text-gray-700 outline-none resize-none bg-transparent p-1.5 rounded-lg hover:bg-gray-50 focus:bg-gray-50"
                  />
                </div>
              ))}
              <div className="bg-white" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
