"use client";

import { CALENDAR_COLUMNS, CalendarColumn, ContentCalendarState, DAYS_OF_WEEK } from "./types";

interface Props {
  calendar: ContentCalendarState;
  onChange: (calendar: ContentCalendarState) => void;
}

const DOT_COLORS: Record<CalendarColumn, string> = {
  newContent: "bg-gray-400",
  creatorFilm: "bg-purple-400",
  postProduction: "bg-amber-400",
  goesLive: "bg-emerald-400",
};

export default function ContentCalendarTab({ calendar, onChange }: Props) {
  function updateCell(day: string, column: CalendarColumn, value: string) {
    onChange({
      cells: {
        ...calendar.cells,
        [day]: { ...calendar.cells[day], [column]: value },
      },
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
          style={{ gridTemplateColumns: "120px repeat(4, 1fr)" }}
        >
          <div className="bg-gray-50" />
          {CALENDAR_COLUMNS.map((col) => (
            <div key={col.id} className="bg-gray-50 px-3 py-2.5 flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[col.id]}`} />
              <span className="text-xs font-semibold text-gray-600">{col.label}</span>
            </div>
          ))}

          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="contents">
              <div className="bg-white px-3 py-2 flex items-center text-sm font-semibold text-gray-700">
                {day}
              </div>
              {CALENDAR_COLUMNS.map((col) => (
                <div key={col.id} className="bg-white p-1">
                  <textarea
                    value={calendar.cells[day]?.[col.id] ?? ""}
                    onChange={(e) => updateCell(day, col.id, e.target.value)}
                    rows={2}
                    placeholder="—"
                    className="w-full text-sm text-gray-700 outline-none resize-none bg-transparent p-1.5 rounded-lg hover:bg-gray-50 focus:bg-gray-50 placeholder:text-gray-300"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
