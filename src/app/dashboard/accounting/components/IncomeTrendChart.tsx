import { useMemo, useState } from 'react';
import type { MonthData } from '../lib/types';
import { calcTotals, currentMonthKey, formatCurrency, monthLabel, shiftMonthKey } from '../lib/calculations';
import { CARD_CLASS } from '../lib/ui';
import { ChartLineIcon, IconBadge, LiveDot } from './icons';

interface Props {
  getMonth: (key: string) => MonthData;
  monthsWithData: string[];
  selectedMonth: string;
  onSelectMonth: (key: string) => void;
}

const SERIES_COLOR = '#2a78d6';
const WIDTH = 900;
const HEIGHT = 360;
const PAD_LEFT = 60;
const PAD_RIGHT = 20;
const PAD_TOP = 20;
const PAD_BOTTOM = 36;

function niceStep(maxAbs: number): number {
  if (maxAbs <= 0) return 1000;
  const rough = maxAbs / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * magnitude;
}

export default function IncomeTrendChart({ getMonth, monthsWithData, selectedMonth, onSelectMonth }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const months = useMemo(() => {
    const base = currentMonthKey();
    const keys = new Set<string>();
    for (let i = -11; i <= 0; i++) keys.add(shiftMonthKey(base, i));
    monthsWithData.forEach((k) => keys.add(k));
    return Array.from(keys).sort();
  }, [monthsWithData]);

  const points = useMemo(
    () => months.map((key) => ({ key, value: calcTotals(getMonth(key)).netProfit })),
    [months, getMonth],
  );

  const maxVal = Math.max(0, ...points.map((p) => p.value));
  const minVal = Math.min(0, ...points.map((p) => p.value));
  const maxAbs = Math.max(Math.abs(maxVal), Math.abs(minVal)) || 1000;
  const step = niceStep(maxAbs);
  const topTick = Math.ceil(maxVal / step) * step || step;
  const bottomTick = Math.floor(minVal / step) * step;
  const range = topTick - bottomTick || 1;

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const yScale = (v: number) => PAD_TOP + plotH - ((v - bottomTick) / range) * plotH;
  const baselineY = yScale(0);

  const bandW = plotW / Math.max(1, points.length - 1 || 1);
  const xScale = (i: number) => (points.length > 1 ? PAD_LEFT + bandW * i : PAD_LEFT + plotW / 2);

  const ticks: number[] = [];
  for (let v = bottomTick; v <= topTick + 1e-6; v += step) ticks.push(Math.round(v * 100) / 100);

  const coords = points.map((p, i) => ({ ...p, x: xScale(i), y: yScale(p.value) }));
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x ?? PAD_LEFT} ${baselineY} L ${coords[0]?.x ?? PAD_LEFT} ${baselineY} Z`;

  const hoveredPoint = points.find((p) => p.key === hovered);

  const formatTick = (t: number) =>
    t === 0 ? '$0' : `${t < 0 ? '-' : ''}$${Math.abs(t) >= 1000 ? `${Math.abs(t) / 1000}k` : Math.abs(t)}`;

  return (
    <div className={`${CARD_CLASS} p-10`}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Income Trend</h2>
          <p className="text-sm text-gray-500">Net Profit (USD), month over month</p>
        </div>
        <IconBadge>
          <ChartLineIcon className="w-5 h-5" />
        </IconBadge>
      </div>
      <div className="flex items-center justify-between mb-6">
        <LiveDot />
        {hoveredPoint && (
          <div className="text-right">
            <div className="text-xs text-gray-500">{monthLabel(hoveredPoint.key)}</div>
            <div className="text-base font-semibold text-gray-900">{formatCurrency(hoveredPoint.value)}</div>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="Net profit by month (USD)">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yScale(t)} y2={yScale(t)} stroke="#e1e0d9" strokeWidth={1} />
            <text x={PAD_LEFT - 12} y={yScale(t)} textAnchor="end" dominantBaseline="middle" fontSize={12} fill="#898781">
              {formatTick(t)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={SERIES_COLOR} opacity={0.08} />
        <path d={linePath} fill="none" stroke={SERIES_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {coords.map((c) => {
          const isSelected = c.key === selectedMonth;
          const isHovered = c.key === hovered;
          const r = isHovered || isSelected ? 7 : 5;
          return (
            <g key={c.key} style={{ cursor: 'pointer' }} onClick={() => onSelectMonth(c.key)}>
              <rect
                x={c.x - bandW / 2}
                y={PAD_TOP}
                width={bandW}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHovered(c.key)}
                onMouseLeave={() => setHovered(null)}
              />
              <circle cx={c.x} cy={c.y} r={r + 2} fill="#ffffff" />
              <circle cx={c.x} cy={c.y} r={r} fill={SERIES_COLOR} opacity={isHovered || isSelected ? 1 : 0.85} />
              <text
                x={c.x}
                y={HEIGHT - PAD_BOTTOM + 20}
                textAnchor="middle"
                fontSize={12}
                fontWeight={isSelected ? 700 : 400}
                fill={isSelected ? '#0b0b0b' : '#898781'}
              >
                {monthLabel(c.key).replace(' 20', " '")}
              </text>
              {isSelected && <rect x={c.x - 10} y={HEIGHT - PAD_BOTTOM + 8} width={20} height={2} rx={1} fill="#0b0b0b" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
