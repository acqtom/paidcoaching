import type { ReactNode } from 'react';
import type { MonthData } from '../lib/types';
import { calcTotals, formatCurrency, monthLabel } from '../lib/calculations';
import { uid } from '../lib/storage';
import { CARD_CLASS } from '../lib/ui';
import { CurrencyInput, ComputedCurrency, TextInput } from './inputs';
import { DocumentIcon, IconBadge, LiveDot } from './icons';

interface Props {
  month: MonthData;
  onChange: (updater: (m: MonthData) => MonthData) => void;
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={3} className="pt-6 pb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
        {children}
      </td>
    </tr>
  );
}

function SpacerRow() {
  return (
    <tr>
      <td colSpan={3} className="h-2" />
    </tr>
  );
}

export default function PnLStatement({ month, onChange }: Props) {
  const t = calcTotals(month);

  const addExpense = () =>
    onChange((m) => ({
      ...m,
      expenses: [...m.expenses, { id: uid(), name: 'New expense', amount: 0 }],
    }));

  const removeExpense = (id: string) =>
    onChange((m) => ({ ...m, expenses: m.expenses.filter((e) => e.id !== id) }));

  const updateExpense = (id: string, patch: Partial<MonthData['expenses'][number]>) =>
    onChange((m) => ({
      ...m,
      expenses: m.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  return (
    <div className={`${CARD_CLASS} p-8`}>
      <div className="flex items-start justify-between mb-2">
        <h2 className="text-3xl font-bold text-gray-900">
          Monthly PnL Statement (Business) — {monthLabel(month.key)}
        </h2>
        <IconBadge>
          <DocumentIcon className="w-5 h-5" />
        </IconBadge>
      </div>
      <LiveDot className="mb-6" />

      <table className="w-full border-collapse">
        <tbody>
          <SectionHeader>Revenue</SectionHeader>
          <tr className="border-b border-gray-100">
            <td className="py-2 pr-2 text-sm text-gray-800">Revenue</td>
            <td className="py-2 w-40">
              <CurrencyInput
                value={month.revenue}
                onChange={(v) => onChange((m) => ({ ...m, revenue: v }))}
              />
            </td>
            <td className="py-2 w-40" />
          </tr>

          <SpacerRow />
          <SectionHeader>Expenses</SectionHeader>
          <tr className="border-b border-gray-100">
            <td className="py-2 text-sm text-gray-800">Editor</td>
            <td className="py-2 w-40">
              <CurrencyInput
                value={month.editorAmount}
                onChange={(v) => onChange((m) => ({ ...m, editorAmount: v }))}
              />
            </td>
            <td className="py-2 w-40" />
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2 text-sm text-gray-800">Ad Spend</td>
            <td className="py-2 w-40">
              <CurrencyInput
                value={month.adSpendAmount}
                onChange={(v) => onChange((m) => ({ ...m, adSpendAmount: v }))}
              />
            </td>
            <td className="py-2 w-40" />
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2 text-sm text-gray-800">Setter (5% of revenue)</td>
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.setterExpense)} />
            </td>
            <td className="py-2 w-40" />
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2 text-sm text-gray-800">Closer (10% of revenue)</td>
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.closerExpense)} />
            </td>
            <td className="py-2 w-40" />
          </tr>
          {month.expenses.map((e) => (
            <tr key={e.id} className="group border-b border-gray-100">
              <td className="py-2 pr-2 text-sm text-gray-800">
                <div className="flex items-center gap-2">
                  <TextInput value={e.name} onChange={(v) => updateExpense(e.id, { name: v })} className="w-full" />
                  <button
                    onClick={() => removeExpense(e.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity text-xs"
                    aria-label="Remove expense"
                  >
                    ✕
                  </button>
                </div>
              </td>
              <td className="py-2 w-40">
                <CurrencyInput value={e.amount} onChange={(v) => updateExpense(e.id, { amount: v })} />
              </td>
              <td className="py-2 w-40" />
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="pt-1 pb-2">
              <button onClick={addExpense} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                + Add expense
              </button>
            </td>
          </tr>
          <tr className="border-t border-gray-200">
            <td className="py-2 font-semibold text-sm text-gray-900">Total Expenses</td>
            <td className="py-2 w-40" />
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.totalExpenses)} bold underline />
            </td>
          </tr>

          <SpacerRow />
          <tr>
            <td className="py-2 font-bold text-base text-gray-900">Net Profit (USD)</td>
            <td className="py-2 w-40" />
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.netProfit)} bold />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
