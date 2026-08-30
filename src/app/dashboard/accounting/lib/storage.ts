import { useCallback, useEffect, useState } from 'react';
import type { AppData, MonthData } from './types';

const STORAGE_KEY = 'accounting-hub-data-v1';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Finds the most recent saved month chronologically before `key`, so a new
// month's recurring expenses (software subscriptions etc.) can carry forward.
function findPreviousMonthWithData(months: Record<string, MonthData>, key: string): MonthData | null {
  let best: MonthData | null = null;
  for (const k of Object.keys(months)) {
    if (k < key && (!best || k > best.key)) best = months[k];
  }
  return best;
}

export function createDefaultMonth(key: string, previousMonth?: MonthData | null): MonthData {
  return {
    key,
    // fixed (not random) ids: this factory runs independently in both
    // getMonth and updateMonth's fallback for a month that isn't saved yet,
    // so random ids would desync between the two and silently drop edits
    clients: [
      { id: 'default-alex', name: 'Alex', revenue: 0, revenueShare: 0 },
      { id: 'default-adriel-hsu', name: 'Adriel Hsu', revenue: 0, revenueShare: 0 },
    ],
    otherRevenue: [],
    expenses: {
      setterPayrollPercent: 5,
      closerPayrollPercent: 10,
      cmoEquityAlexPercent: 10,
      cmoEquityAdrielPercent: 3,
      // carry recurring software expenses forward from the previous month
      // (same ids preserved, not regenerated, for the reason noted above)
      software: previousMonth ? previousMonth.expenses.software.map((s) => ({ ...s })) : [],
    },
    fxRateUsdToNzd: 1.7,
  };
}

// Reconciles a month loaded from localStorage against the current MonthData
// shape. Older saved months can be missing fields added since they were
// written (or carry fields since removed) — reading a missing numeric field
// produces NaN, which silently poisons every downstream calculation and
// breaks the chart. Filling gaps with current defaults here, once, keeps
// every other call site free to assume a complete, valid MonthData.
function normalizeMonth(key: string, raw: Partial<MonthData> | undefined): MonthData {
  const base = createDefaultMonth(key);
  if (!raw) return base;
  const rawExpenses = raw.expenses as Partial<MonthData['expenses']> | undefined;
  return {
    key,
    clients:
      Array.isArray(raw.clients) && raw.clients.length > 0
        ? raw.clients.map((c) => ({
            id: c.id ?? uid(),
            name: c.name ?? '',
            revenue: c.revenue ?? 0,
            revenueShare: c.revenueShare ?? 0,
          }))
        : base.clients,
    otherRevenue: Array.isArray(raw.otherRevenue)
      ? raw.otherRevenue.map((r) => ({ id: r.id ?? uid(), name: r.name ?? '', amount: r.amount ?? 0 }))
      : [],
    expenses: {
      setterPayrollPercent: rawExpenses?.setterPayrollPercent ?? base.expenses.setterPayrollPercent,
      closerPayrollPercent: rawExpenses?.closerPayrollPercent ?? base.expenses.closerPayrollPercent,
      cmoEquityAlexPercent: rawExpenses?.cmoEquityAlexPercent ?? base.expenses.cmoEquityAlexPercent,
      cmoEquityAdrielPercent: rawExpenses?.cmoEquityAdrielPercent ?? base.expenses.cmoEquityAdrielPercent,
      software: Array.isArray(rawExpenses?.software)
        ? rawExpenses.software.map((s) => ({ id: s.id ?? uid(), name: s.name ?? '', amount: s.amount ?? 0 }))
        : [],
    },
    fxRateUsdToNzd: raw.fxRateUsdToNzd ?? base.fxRateUsdToNzd,
  };
}

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = { months: {}, invoices: [], nextInvoiceNumber: 1, savedClients: [], ...JSON.parse(raw) };
      const months: Record<string, MonthData> = {};
      for (const [key, month] of Object.entries(parsed.months as Record<string, Partial<MonthData>>)) {
        months[key] = normalizeMonth(key, month);
      }
      return { ...parsed, months };
    }
  } catch {
    // ignore corrupt storage
  }
  return { months: {}, invoices: [], nextInvoiceNumber: 1, savedClients: [] };
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const updateMonth = useCallback((key: string, updater: (m: MonthData) => MonthData) => {
    setData((prev) => {
      const existing = prev.months[key] ?? createDefaultMonth(key, findPreviousMonthWithData(prev.months, key));
      return { ...prev, months: { ...prev.months, [key]: updater(existing) } };
    });
  }, []);

  const getMonth = useCallback(
    (key: string): MonthData => data.months[key] ?? createDefaultMonth(key, findPreviousMonthWithData(data.months, key)),
    [data.months],
  );

  return { data, setData, updateMonth, getMonth };
}

export { uid };
