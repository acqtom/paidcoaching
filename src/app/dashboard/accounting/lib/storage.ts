import { useCallback, useEffect, useState } from 'react';
import type { AppData, MonthData } from './types';

const STORAGE_KEY = 'accounting-hub-data-v1';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Finds the most recent saved month chronologically before `key`, so a new
// month's recurring costs (Editor, other recurring expenses) can carry
// forward.
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
    revenue: 0,
    // Editor pay and other recurring expenses carry forward (same ids
    // preserved, not regenerated) since they tend to repeat month to month;
    // revenue does not, since that's different every month.
    editorAmount: previousMonth ? previousMonth.editorAmount : 0,
    expenses: previousMonth ? previousMonth.expenses.map((e) => ({ ...e })) : [],
  };
}

// Reconciles a month loaded from localStorage against the current MonthData
// shape. Handles both older saved months missing fields added since they
// were written, and the pre-simplification shape (per-client revenue,
// CMO pay/equity, bonuses, a nested expenses.software list) from before
// the PnL statement was cut down to a single revenue number and a flat
// expense list.
function normalizeMonth(key: string, raw: Record<string, unknown> | undefined): MonthData {
  const base = createDefaultMonth(key);
  if (!raw) return base;

  let revenue = typeof raw.revenue === 'number' ? raw.revenue : 0;
  if (!revenue && Array.isArray(raw.clients)) {
    // Pre-simplification shape: revenue was split across named clients.
    revenue = (raw.clients as Array<{ revenue?: number }>).reduce((sum, c) => sum + (c.revenue || 0), 0);
  }

  const editorAmount = typeof raw.editorAmount === 'number' ? raw.editorAmount : 0;

  let expenses: MonthData['expenses'] = [];
  if (Array.isArray(raw.expenses)) {
    expenses = (raw.expenses as Array<{ id?: string; name?: string; amount?: number }>).map((e) => ({
      id: e.id ?? uid(),
      name: e.name ?? '',
      amount: e.amount ?? 0,
    }));
  } else if (raw.expenses && typeof raw.expenses === 'object' && Array.isArray((raw.expenses as { software?: unknown }).software)) {
    // Pre-simplification shape: expenses was an object with a software list.
    expenses = ((raw.expenses as { software: Array<{ id?: string; name?: string; amount?: number }> }).software).map((e) => ({
      id: e.id ?? uid(),
      name: e.name ?? '',
      amount: e.amount ?? 0,
    }));
  }

  return { key, revenue, editorAmount, expenses };
}

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = { months: {}, invoices: [], nextInvoiceNumber: 1, savedClients: [], ...JSON.parse(raw) };
      const months: Record<string, MonthData> = {};
      for (const [key, month] of Object.entries(parsed.months as Record<string, Record<string, unknown>>)) {
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
