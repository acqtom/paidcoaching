import { useState } from 'react';
import { calcCapitalAllocations, formatCurrency } from '../lib/calculations';
import { uid } from '../lib/storage';
import { CARD_CLASS } from '../lib/ui';
import { TextInput } from './inputs';
import { IconBadge, LiveDot, PieChartIcon } from './icons';
import type { CapitalAllocationCategory } from '../lib/types';

interface Props {
  netProfit: number;
  categories: CapitalAllocationCategory[];
  onChange: (updater: (categories: CapitalAllocationCategory[]) => CapitalAllocationCategory[]) => void;
}

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 90;
const STROKE = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#8b5cf6', '#0891b2', '#dc2626'];

export default function CapitalAllocationChart({ netProfit, categories, onChange }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const slices = calcCapitalAllocations(netProfit, categories).map((s, i) => ({
    ...s,
    color: PALETTE[i % PALETTE.length],
  }));

  const addCategory = () =>
    onChange((cats) => [...cats, { id: uid(), name: 'New category', percent: 0 }]);

  const removeCategory = (id: string) => onChange((cats) => cats.filter((c) => c.id !== id));

  const updateCategory = (id: string, patch: Partial<CapitalAllocationCategory>) =>
    onChange((cats) => cats.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  // Each arc's starting offset is the sum of every prior slice's fraction of
  // the circle -- computed per-slice from `slices` rather than via a mutable
  // running total, since categories is always small enough that this stays
  // cheap either way.
  const arcs = slices.map((s, i) => {
    const priorFractions = slices.slice(0, i).reduce((sum, p) => sum + p.percent / 100, 0);
    const fraction = s.percent / 100;
    const arcLen = Math.max(0, fraction * CIRCUMFERENCE);
    const offset = -priorFractions * CIRCUMFERENCE;
    return { ...s, arcLen, offset };
  });

  const percentTotal = categories.reduce((sum, c) => sum + (c.percent || 0), 0);
  const hoveredSlice = slices.find((s) => s.id === hovered);
  const total = Math.max(0, netProfit);

  return (
    <div className={`${CARD_CLASS} p-10`}>
      <div className="flex items-start justify-between mb-1">
        <h2 className="text-xl font-semibold text-gray-900">Capital Allocation</h2>
        <IconBadge>
          <PieChartIcon className="w-5 h-5" />
        </IconBadge>
      </div>
      <p className="text-sm text-gray-500 mb-2">Where this month&apos;s net profit should go</p>
      <div className="flex items-center justify-between mb-6">
        <LiveDot />
        <span className={`text-xs font-medium ${percentTotal === 100 ? 'text-gray-400' : 'text-amber-600'}`}>
          {percentTotal}% allocated
        </span>
      </div>

      {total <= 0 ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Add revenue to this month to see an allocation.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-6 mb-6">
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Capital allocation breakdown">
              <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#e1e0d9" strokeWidth={STROKE} />
              <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
                {arcs.map((a) => (
                  <circle
                    key={a.id}
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${a.arcLen} ${CIRCUMFERENCE - a.arcLen}`}
                    strokeDashoffset={a.offset}
                    opacity={hovered && hovered !== a.id ? 0.35 : 1}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                    onMouseEnter={() => setHovered(a.id)}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
              <div className="text-xs text-gray-500">{hoveredSlice ? hoveredSlice.name : 'Net Profit'}</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(hoveredSlice ? hoveredSlice.amount : total)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {slices.map((s) => (
          <div
            key={s.id}
            className="group flex items-center gap-3 rounded-lg px-3 py-2 -mx-3 transition-colors"
            style={{ backgroundColor: hovered === s.id ? '#f9f9f7' : 'transparent' }}
            onMouseEnter={() => setHovered(s.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <TextInput
              value={s.name}
              onChange={(v) => updateCategory(s.id, { name: v })}
              className="flex-1 min-w-0 text-sm text-gray-800"
            />
            <div className="flex items-center gap-1 shrink-0 w-16">
              <input
                type="number"
                step="1"
                value={s.percent}
                onChange={(e) => updateCategory(s.id, { percent: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                onFocus={(e) => e.target.select()}
                className="w-10 bg-transparent text-sm text-gray-600 text-right outline-none focus:bg-indigo-50 rounded px-1 py-0.5"
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
            <div className="text-sm font-semibold text-gray-900 text-right shrink-0 w-24">
              {formatCurrency(s.amount)}
            </div>
            <button
              onClick={() => removeCategory(s.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity text-xs shrink-0"
              aria-label="Remove category"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={addCategory} className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
        + Add category
      </button>
    </div>
  );
}
