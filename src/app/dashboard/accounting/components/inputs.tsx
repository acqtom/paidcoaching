interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  emphasis?: boolean;
  underline?: boolean;
  align?: 'left' | 'right';
}

export function CurrencyInput({ value, onChange, underline, align = 'right' }: CurrencyInputProps) {
  return (
    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
      <span className="text-gray-400 text-sm">$</span>
      <input
        type="number"
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
        onFocus={(e) => e.target.select()}
        className={`w-full bg-transparent text-sm text-gray-900 text-right outline-none focus:bg-indigo-50 rounded px-1 py-0.5 transition-colors ${
          underline ? 'border-b border-gray-300' : ''
        }`}
      />
    </div>
  );
}

export function ComputedCurrency({ value, bold, underline }: { value: string; bold?: boolean; underline?: boolean }) {
  return (
    <div
      className={`text-right text-sm px-1 py-0.5 ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'} ${
        underline ? 'border-b border-gray-400 inline-block' : ''
      }`}
    >
      {value}
    </div>
  );
}

export function PercentInline({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-gray-500">
      (
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
        onFocus={(e) => e.target.select()}
        className="w-10 bg-transparent text-gray-500 outline-none focus:bg-indigo-50 rounded text-center"
      />
      %)
    </span>
  );
}

export function TextInput({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent outline-none focus:bg-indigo-50 rounded px-1 py-0.5 transition-colors ${className}`}
    />
  );
}
