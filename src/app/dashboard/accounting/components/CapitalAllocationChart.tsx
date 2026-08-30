import { useMemo, useState } from 'react';
import { calcCapitalAllocation } from '../lib/calculations';
import { formatCurrency } from '../lib/calculations';
import { CARD_CLASS } from '../lib/ui';
import { IconBadge, LiveDot, PieChartIcon } from './icons';

interface Props {
  netProfit: number;
}

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 90;
const STROKE = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 0;

const SLOT_COLORS = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  magenta: '#e87ba4',
};

export default function CapitalAllocationChart({ netProfit }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const alloc = calcCapitalAllocation(netProfit);

  const slices = useMemo(
    () => [
      { key: 'software', label: 'Software', sublabel: '$500 max', value: alloc.software, color: SLOT_COLORS.blue },
      { key: 'rent', label: 'Rent', sublabel: '$3,000', value: alloc.rent, color: SLOT_COLORS.orange },
      { key: 'food', label: 'Food', sublabel: '$1,500', value: alloc.food, color: SLOT_COLORS.aqua },
      { key: 'businessBank', label: 'Business bank', sublabel: '70% of remainder', value: alloc.businessBank, color: SLOT_COLORS.yellow },
      { key: 'checking', label: 'Checking', sublabel: '', value: alloc.checking, color: SLOT_COLORS.magenta },
    ],
    [alloc],
  );

  const total = alloc.total;
  let cumulative = 0;
  const arcs = slices.map((s) => {
    const fraction = total > 0 ? s.value / total : 0;
    const arcLen = Math.max(0, fraction * CIRCUMFERENCE - GAP);
    const offset = -cumulative * CIRCUMFERENCE;
    cumulative += fraction;
    return { ...s, arcLen, offset, fraction };
  });

  const hoveredSlice = slices.find((s) => s.key === hovered);

  return (
    <div className={`${CARD_CLASS} p-10`}>
      <div className="flex items-start justify-between mb-1">
        <h2 className="text-xl font-semibold text-gray-900">Capital Allocation</h2>
        <IconBadge>
          <PieChartIcon className="w-5 h-5" />
        </IconBadge>
      </div>
      <p className="text-sm text-gray-500 mb-2">Where this month&apos;s net profit should go</p>
      <LiveDot className="mb-6" />

      {total <= 0 ? (
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">
          Add revenue to this month to see an allocation.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Capital allocation breakdown">
              <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#e1e0d9" strokeWidth={STROKE} />
              <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
                {arcs.map((a) => (
                  <circle
                    key={a.key}
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${a.arcLen} ${CIRCUMFERENCE - a.arcLen}`}
                    strokeDashoffset={a.offset}
                    opacity={hovered && hovered !== a.key ? 0.35 : 1}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                    onMouseEnter={() => setHovered(a.key)}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
              <div className="text-xs text-gray-500">{hoveredSlice ? hoveredSlice.label : 'Total'}</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(hoveredSlice ? hoveredSlice.value : total)}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 w-full space-y-3.5">
            {slices.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 -mx-3 transition-colors"
                style={{ backgroundColor: hovered === s.key ? '#f9f9f7' : 'transparent' }}
                onMouseEnter={() => setHovered(s.key)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <div className="min-w-0">
                    <div className="text-lg text-gray-800 truncate">{s.label}</div>
                    <div className="text-sm text-gray-400 truncate">{s.sublabel}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(s.value)}</div>
                  <div className="text-sm text-gray-400">
                    {/* Business bank is always exactly 70% of what's left after
                        Software/Rent/Food by definition, so its badge is fixed
                        rather than diluted by how much of the total those ate
                        into. Checking just gets whatever's left, so its badge
                        floats naturally against the month's total income. */}
                    {s.key === 'businessBank' ? '70%' : total > 0 ? `${((s.value / total) * 100).toFixed(0)}%` : '0%'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
