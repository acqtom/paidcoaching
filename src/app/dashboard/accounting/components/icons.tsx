import type { ReactNode } from 'react';

interface IconProps {
  className?: string;
}

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </Svg>
  );
}

export function ChartLineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19h16" />
      <path d="M4 15l4-5 4 3 5-7 3 4" />
    </Svg>
  );
}

export function PieChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 3.06A9 9 0 1 0 20.94 13H11V3.06Z" />
      <path d="M20.49 8.5A9 9 0 0 0 15.5 3.51V8.5h4.99Z" />
    </Svg>
  );
}

export function LiveDot({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-indigo-600 uppercase ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
      Live
    </span>
  );
}

export function IconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600">
      {children}
    </span>
  );
}
