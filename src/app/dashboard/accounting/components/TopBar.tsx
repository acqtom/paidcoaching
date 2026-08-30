import { useMemo, useRef } from 'react';
import { currentMonthKey, monthLabel, shiftMonthKey } from '../lib/calculations';

interface Props {
  selectedMonth: string;
  onSelectMonth: (key: string) => void;
  monthsWithData: string[];
  onCreateInvoice: () => void;
  onAddMonth: () => void;
}

export default function TopBar({ selectedMonth, onSelectMonth, monthsWithData, onCreateInvoice, onAddMonth }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => {
    const base = currentMonthKey();
    const keys = new Set<string>();
    for (let i = -11; i <= 1; i++) keys.add(shiftMonthKey(base, i));
    monthsWithData.forEach((k) => keys.add(k));
    return Array.from(keys).sort();
  }, [monthsWithData]);

  const scroll = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto px-8 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Accounting Hub</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={onAddMonth}
            className="inline-flex items-center gap-1.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span> New Month
          </button>
          <button
            onClick={onCreateInvoice}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <span className="text-base leading-none">+</span> Create Invoice
          </button>
        </div>
      </div>
      <div className="max-w-[1600px] mx-auto px-8 pb-4 flex items-center gap-2">
        <button
          onClick={() => scroll(-1)}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Scroll months left"
        >
          ‹
        </button>
        <div ref={scrollerRef} className="flex items-center gap-1.5 overflow-x-auto scrollbar-none scroll-smooth">
          {months.map((key) => {
            const active = key === selectedMonth;
            return (
              <button
                key={key}
                onClick={() => onSelectMonth(key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {monthLabel(key)}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => scroll(1)}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Scroll months right"
        >
          ›
        </button>
      </div>
    </div>
  );
}
