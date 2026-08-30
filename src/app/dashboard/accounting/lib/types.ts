export interface LineItem {
  id: string;
  name: string;
  amount: number;
}

export interface MonthData {
  key: string; // "2026-07"
  revenue: number;
  editorAmount: number;
  adSpendAmount: number;
  expenses: LineItem[];
}

export interface CapitalAllocationCategory {
  id: string;
  name: string;
  percent: number;
}

export interface AppData {
  months: Record<string, MonthData>;
  capitalCategories: CapitalAllocationCategory[];
}
