export interface LineItem {
  id: string;
  name: string;
  amount: number;
}

export interface MonthData {
  key: string; // "2026-07"
  revenue: number;
  editorAmount: number;
  expenses: LineItem[];
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  qty: number;
  rate: number;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  fromName: string;
  fromAddress: string;
  fromEmail: string;
  toName: string;
  toAddress: string;
  toEmail: string;
  items: InvoiceLineItem[];
  grossRevenueShareLabel: string;
  grossRevenueShareAmount: number;
  createdAt: string;
}

export interface SavedClient {
  id: string;
  name: string;
  fromName: string;
  fromAddress: string;
  fromEmail: string;
  toName: string;
  toAddress: string;
  toEmail: string;
  items: InvoiceLineItem[];
}

export interface AppData {
  months: Record<string, MonthData>;
  invoices: Invoice[];
  nextInvoiceNumber: number;
  savedClients: SavedClient[];
}
