import type { CapitalAllocationCategory, MonthData } from './types';

const SETTER_RATE = 0.05;
const CLOSER_RATE = 0.1;

export function calcTotals(month: MonthData) {
  const setterExpense = month.revenue * SETTER_RATE;
  const closerExpense = month.revenue * CLOSER_RATE;
  const otherExpensesTotal = month.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalExpenses =
    month.editorAmount +
    month.adSpendAmount +
    month.processingFeesAmount +
    setterExpense +
    closerExpense +
    otherExpensesTotal;
  const netProfit = month.revenue - totalExpenses;

  return {
    setterExpense,
    closerExpense,
    otherExpensesTotal,
    totalExpenses,
    netProfit,
  };
}

export interface CapitalAllocationSlice extends CapitalAllocationCategory {
  amount: number;
}

// Each category's dollar amount is just its own percent of net profit --
// independent of the other categories, so the percentages don't have to
// (but usually should) add up to 100.
export function calcCapitalAllocations(
  netProfit: number,
  categories: CapitalAllocationCategory[],
): CapitalAllocationSlice[] {
  const total = Math.max(0, netProfit);
  return categories.map((c) => ({ ...c, amount: total * (c.percent / 100) }));
}

export function formatCurrency(value: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prefix = value < 0 ? '-$' : opts.sign ? '+$' : '$';
  return `${prefix}${formatted}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
