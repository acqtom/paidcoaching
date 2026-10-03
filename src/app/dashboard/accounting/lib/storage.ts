import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData, CapitalAllocationCategory, MonthData } from './types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_CAPITAL_CATEGORIES: CapitalAllocationCategory[] = [
  { id: 'default-software', name: 'Software', percent: 5 },
  { id: 'default-rent', name: 'Rent', percent: 20 },
  { id: 'default-food', name: 'Food', percent: 10 },
  { id: 'default-business-bank', name: 'Business bank', percent: 45 },
  { id: 'default-checking', name: 'Checking', percent: 20 },
];

// Finds the most recent saved month chronologically before `key`, so a new
// month's recurring costs (Editor, Ad Spend, other recurring expenses) can
// carry forward.
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
    // Recurring costs carry forward (same ids preserved, not regenerated);
    // revenue does not, since that's different every month.
    editorAmount: previousMonth ? previousMonth.editorAmount : 0,
    adSpendAmount: previousMonth ? previousMonth.adSpendAmount : 0,
    processingFeesAmount: previousMonth ? previousMonth.processingFeesAmount : 0,
    expenses: previousMonth ? previousMonth.expenses.map((e) => ({ ...e })) : [],
  };
}

// Reconciles a month loaded from the server against the current MonthData
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
  const adSpendAmount = typeof raw.adSpendAmount === 'number' ? raw.adSpendAmount : 0;
  // Missing on any month saved before this field existed -- defaults to 0,
  // same as editor/ad spend did when they were first added.
  const processingFeesAmount = typeof raw.processingFeesAmount === 'number' ? raw.processingFeesAmount : 0;

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

  return { key, revenue, editorAmount, adSpendAmount, processingFeesAmount, expenses };
}

function normalizeCapitalCategories(raw: unknown): CapitalAllocationCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_CAPITAL_CATEGORIES.map((c) => ({ ...c }));
  return (raw as Array<{ id?: string; name?: string; percent?: number }>).map((c) => ({
    id: c.id ?? uid(),
    name: c.name ?? '',
    percent: c.percent ?? 0,
  }));
}

function parseAppData(parsed: Record<string, unknown>): AppData {
  const months: Record<string, MonthData> = {};
  for (const [key, month] of Object.entries((parsed.months ?? {}) as Record<string, Record<string, unknown>>)) {
    months[key] = normalizeMonth(key, month);
  }
  return { months, capitalCategories: normalizeCapitalCategories(parsed.capitalCategories) };
}

function emptyAppData(): AppData {
  return { months: {}, capitalCategories: DEFAULT_CAPITAL_CATEGORIES.map((c) => ({ ...c })) };
}

// Loads this account's numbers from the server (see
// 0026_accounting_state.sql) and saves every change back. Saves are held
// back until the load has succeeded, so an unloaded empty state can never
// overwrite real saved numbers.
export function useAppData() {
  const [data, setData] = useState<AppData>(emptyAppData);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/accounting/session', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((res: { data?: Record<string, unknown> }) => {
        if (cancelled) return;
        setData(parseAppData(res.data ?? {}));
        loadedRef.current = true;
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/accounting/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      }).catch(() => {});
    }, 400);
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

  return { data, setData, updateMonth, getMonth, loaded, loadFailed };
}

export { uid };
