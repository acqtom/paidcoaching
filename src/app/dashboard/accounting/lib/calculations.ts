import type { Invoice, MonthData } from './types';

const SETTER_RATE = 0.05;
const CLOSER_RATE = 0.1;

export function calcTotals(month: MonthData) {
  const setterExpense = month.revenue * SETTER_RATE;
  const closerExpense = month.revenue * CLOSER_RATE;
  const otherExpensesTotal = month.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalExpenses = month.editorAmount + setterExpense + closerExpense + otherExpensesTotal;
  const netProfit = month.revenue - totalExpenses;

  return {
    setterExpense,
    closerExpense,
    otherExpensesTotal,
    totalExpenses,
    netProfit,
  };
}

const SOFTWARE_CAP = 500;
const RENT = 3000;
const FOOD = 1500;
const BUSINESS_BANK_SPLIT = 0.7;

export interface CapitalAllocation {
  total: number;
  software: number;
  rent: number;
  food: number;
  businessBank: number;
  checking: number;
}

export function calcCapitalAllocation(netProfit: number): CapitalAllocation {
  const total = Math.max(0, netProfit);
  let remaining = total;

  const software = Math.min(SOFTWARE_CAP, remaining);
  remaining -= software;
  const rent = Math.min(RENT, remaining);
  remaining -= rent;
  const food = Math.min(FOOD, remaining);
  remaining -= food;

  const businessBank = remaining * BUSINESS_BANK_SPLIT;
  const checking = remaining - businessBank;

  return { total, software, rent, food, businessBank, checking };
}

// Older saved invoices predate grossRevenueShareAmount, so it's optional on
// read — treat missing as zero rather than poisoning the sum with NaN.
export function invoiceTotal(invoice: Pick<Invoice, 'items' | 'grossRevenueShareAmount'>): number {
  const itemsTotal = invoice.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
  return itemsTotal + (invoice.grossRevenueShareAmount ?? 0);
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
