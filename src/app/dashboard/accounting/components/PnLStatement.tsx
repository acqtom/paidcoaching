import type { ReactNode } from 'react';
import type { MonthData } from '../lib/types';
import { calcTotals, formatCurrency, monthLabel } from '../lib/calculations';
import { uid } from '../lib/storage';
import { CARD_CLASS } from '../lib/ui';
import { CurrencyInput, ComputedCurrency, PercentInline, TextInput } from './inputs';
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

  const addClient = () =>
    onChange((m) => ({
      ...m,
      clients: [...m.clients, { id: uid(), name: 'New client', revenue: 0, revenueShare: 0 }],
    }));

  const removeClient = (id: string) =>
    onChange((m) => ({ ...m, clients: m.clients.filter((c) => c.id !== id) }));

  const updateClient = (id: string, patch: Partial<MonthData['clients'][number]>) =>
    onChange((m) => ({
      ...m,
      clients: m.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));

  const addOtherRevenue = () =>
    onChange((m) => ({
      ...m,
      otherRevenue: [...m.otherRevenue, { id: uid(), name: 'New revenue', amount: 0 }],
    }));

  const removeOtherRevenue = (id: string) =>
    onChange((m) => ({ ...m, otherRevenue: m.otherRevenue.filter((r) => r.id !== id) }));

  const updateOtherRevenue = (id: string, patch: Partial<MonthData['otherRevenue'][number]>) =>
    onChange((m) => ({
      ...m,
      otherRevenue: m.otherRevenue.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));

  const addSoftware = () =>
    onChange((m) => ({
      ...m,
      expenses: { ...m.expenses, software: [...m.expenses.software, { id: uid(), name: 'New software', amount: 0 }] },
    }));

  const removeSoftware = (id: string) =>
    onChange((m) => ({ ...m, expenses: { ...m.expenses, software: m.expenses.software.filter((s) => s.id !== id) } }));

  const updateSoftware = (id: string, patch: Partial<MonthData['expenses']['software'][number]>) =>
    onChange((m) => ({
      ...m,
      expenses: {
        ...m.expenses,
        software: m.expenses.software.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      },
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
          {month.clients.map((c) => (
            <tr key={c.id} className="group border-b border-gray-100">
              <td className="py-2 pr-2 text-sm text-gray-800">
                <div className="flex items-center gap-2">
                  <TextInput value={c.name} onChange={(v) => updateClient(c.id, { name: v })} className="w-full" />
                  <button
                    onClick={() => removeClient(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity text-xs"
                    aria-label="Remove client"
                  >
                    ✕
                  </button>
                </div>
              </td>
              <td className="py-2 w-40">
                <CurrencyInput value={c.revenue} onChange={(v) => updateClient(c.id, { revenue: v })} />
              </td>
              <td className="py-2 w-40" />
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="pt-1 pb-2">
              <button onClick={addClient} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                + Add client
              </button>
            </td>
          </tr>
          <tr className="border-t border-gray-200">
            <td className="py-2 font-semibold text-sm text-gray-900">Total Portfolio Revenue</td>
            <td className="py-2 w-40" />
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.totalPortfolioRevenue)} bold />
            </td>
          </tr>

          <SpacerRow />
          <SectionHeader>Other Revenue</SectionHeader>
          {month.otherRevenue.map((r) => (
            <tr key={r.id} className="group border-b border-gray-100">
              <td className="py-2 pr-2 text-sm text-gray-800">
                <div className="flex items-center gap-2">
                  <TextInput value={r.name} onChange={(v) => updateOtherRevenue(r.id, { name: v })} className="w-full" />
                  <button
                    onClick={() => removeOtherRevenue(r.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity text-xs"
                    aria-label="Remove other revenue"
                  >
                    ✕
                  </button>
                </div>
              </td>
              <td className="py-2 w-40">
                <CurrencyInput value={r.amount} onChange={(v) => updateOtherRevenue(r.id, { amount: v })} />
              </td>
              <td className="py-2 w-40" />
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="pt-1 pb-2">
              <button onClick={addOtherRevenue} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                + Add other revenue
              </button>
            </td>
          </tr>
          <tr className="border-t border-gray-200">
            <td className="py-2 font-semibold text-sm text-gray-900">Total Other Revenue</td>
            <td className="py-2 w-40" />
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.totalOtherRevenue)} bold />
            </td>
          </tr>

          <SpacerRow />
          <SectionHeader>Less: Client Revenue Share</SectionHeader>
          {month.clients.map((c) => {
            const rate = t.clientShareRates[c.id];
            return (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-2 pr-2 text-sm text-gray-800 underline decoration-gray-300">
                  {c.name}
                  {rate !== undefined && <span className="ml-1 text-xs text-gray-400">({Math.round(rate * 100)}%)</span>}
                </td>
                <td className="py-2 w-40">
                  {rate !== undefined ? (
                    <ComputedCurrency value={formatCurrency(t.clientShares[c.id])} underline />
                  ) : (
                    <CurrencyInput value={c.revenueShare} onChange={(v) => updateClient(c.id, { revenueShare: v })} underline />
                  )}
                </td>
                <td className="py-2 w-40" />
              </tr>
            );
          })}
          <tr className="border-t border-gray-200">
            <td className="py-2 font-semibold text-sm text-gray-900">Total Client Revenue Share</td>
            <td className="py-2 w-40" />
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.totalClientRevenueShare)} bold underline />
            </td>
          </tr>
          <tr>
            <td className="py-2 font-semibold text-sm text-gray-900">Gross Portfolio Revenue</td>
            <td className="py-2 w-40" />
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.grossPortfolioRevenue)} bold />
            </td>
          </tr>

          <SpacerRow />
          <SectionHeader>Expenses</SectionHeader>
          <tr className="border-b border-gray-100">
            <td className="py-2 text-sm text-gray-800">CMO Base Pay</td>
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.cmoBasePay)} />
            </td>
            <td className="py-2 w-40" />
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2 text-sm text-gray-800">
              Setter Payroll{' '}
              <PercentInline
                value={month.expenses.setterPayrollPercent}
                onChange={(v) => onChange((m) => ({ ...m, expenses: { ...m.expenses, setterPayrollPercent: v } }))}
              />
            </td>
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.setterPayroll)} />
            </td>
            <td className="py-2 w-40" />
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2 text-sm text-gray-800">
              Closer Payroll{' '}
              <PercentInline
                value={month.expenses.closerPayrollPercent}
                onChange={(v) => onChange((m) => ({ ...m, expenses: { ...m.expenses, closerPayrollPercent: v } }))}
              />
            </td>
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.closerPayroll)} />
            </td>
            <td className="py-2 w-40" />
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2 text-sm text-gray-800">
              CMO Equity (Alex){' '}
              <PercentInline
                value={month.expenses.cmoEquityAlexPercent}
                onChange={(v) => onChange((m) => ({ ...m, expenses: { ...m.expenses, cmoEquityAlexPercent: v } }))}
              />
            </td>
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.cmoEquityAlex)} />
            </td>
            <td className="py-2 w-40" />
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2 text-sm text-gray-800">
              CMO Equity (Adriel){' '}
              <PercentInline
                value={month.expenses.cmoEquityAdrielPercent}
                onChange={(v) => onChange((m) => ({ ...m, expenses: { ...m.expenses, cmoEquityAdrielPercent: v } }))}
              />
            </td>
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.cmoEquityAdriel)} />
            </td>
            <td className="py-2 w-40" />
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2 text-sm text-gray-800">Bonuses ($1k per $40k revenue)</td>
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.bonuses)} />
            </td>
            <td className="py-2 w-40" />
          </tr>
          <tr>
            <td className="py-2 text-sm text-gray-800 align-top">Business softwares</td>
            <td colSpan={2} className="py-2">
              <div className="space-y-1">
                {month.expenses.software.map((s) => (
                  <div key={s.id} className="group flex items-center gap-2">
                    <TextInput value={s.name} onChange={(v) => updateSoftware(s.id, { name: v })} className="flex-1 text-sm text-gray-700" />
                    <div className="w-32">
                      <CurrencyInput value={s.amount} onChange={(v) => updateSoftware(s.id, { amount: v })} />
                    </div>
                    <button
                      onClick={() => removeSoftware(s.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity text-xs"
                      aria-label="Remove software"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button onClick={addSoftware} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  + Add software
                </button>
              </div>
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
            <td className="py-2 font-bold text-base text-gray-900">Net Personal Income (USD)</td>
            <td className="py-2 w-40" />
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.netPersonalIncomeUsd)} bold />
            </td>
          </tr>
          <tr>
            <td className="py-2 font-bold text-base text-gray-900">
              Net Personal Income (NZD)
              <span className="block mt-1 font-normal text-xs text-gray-400">
                FX rate:
                <input
                  type="number"
                  step="0.001"
                  value={month.fxRateUsdToNzd}
                  onChange={(e) =>
                    onChange((m) => ({ ...m, fxRateUsdToNzd: e.target.value === '' ? 0 : parseFloat(e.target.value) }))
                  }
                  onFocus={(e) => e.target.select()}
                  className="w-16 ml-1 bg-transparent border-b border-gray-300 outline-none focus:bg-indigo-50 rounded px-1 text-gray-600"
                />
              </span>
            </td>
            <td className="py-2 w-40" />
            <td className="py-2 w-40">
              <ComputedCurrency value={formatCurrency(t.netPersonalIncomeNzd)} bold />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
