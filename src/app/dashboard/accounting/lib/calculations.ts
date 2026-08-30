import type { ClientRevenue, Invoice, MonthData } from './types';

const BONUS_TIER_REVENUE = 40000;
const BONUS_PER_TIER = 1000;
const CMO_BASE_PAY_USD = 3000;
const ALEX_CLIENT_SHARE_RATE = 0.5;
const ADRIEL_CLIENT_SHARE_RATE = 0.65;

function findAlexClient(clients: ClientRevenue[]): ClientRevenue | undefined {
  return clients.find((c) => c.id === 'default-alex') ?? clients.find((c) => c.name.trim().toLowerCase() === 'alex');
}

function findAdrielClient(clients: ClientRevenue[]): ClientRevenue | undefined {
  return (
    clients.find((c) => c.id === 'default-adriel-hsu') ??
    clients.find((c) => c.name.trim().toLowerCase().includes('adriel'))
  );
}

export function calcTotals(month: MonthData) {
  const totalPortfolioRevenue = month.clients.reduce((sum, c) => sum + (c.revenue || 0), 0);
  const totalOtherRevenue = month.otherRevenue.reduce((sum, r) => sum + (r.amount || 0), 0);

  const alexClient = findAlexClient(month.clients);
  const adrielClient = findAdrielClient(month.clients);

  // Alex and Adriel's client revenue share is a fixed rate of their own
  // revenue, not manually entered; other clients keep the manual field.
  const clientShares: Record<string, number> = {};
  const clientShareRates: Record<string, number> = {};
  const totalClientRevenueShare = month.clients.reduce((sum, c) => {
    let share: number;
    if (c === alexClient) {
      share = c.revenue * ALEX_CLIENT_SHARE_RATE;
      clientShareRates[c.id] = ALEX_CLIENT_SHARE_RATE;
    } else if (c === adrielClient) {
      share = c.revenue * ADRIEL_CLIENT_SHARE_RATE;
      clientShareRates[c.id] = ADRIEL_CLIENT_SHARE_RATE;
    } else {
      share = c.revenueShare || 0;
    }
    clientShares[c.id] = share;
    return sum + share;
  }, 0);

  const grossPortfolioRevenue = totalPortfolioRevenue + totalOtherRevenue - totalClientRevenueShare;

  const setterPayroll = totalPortfolioRevenue * (month.expenses.setterPayrollPercent / 100);
  const closerPayroll = totalPortfolioRevenue * (month.expenses.closerPayrollPercent / 100);
  const cmoBasePay = CMO_BASE_PAY_USD;
  const cmoEquityAlex = (alexClient?.revenue ?? 0) * (month.expenses.cmoEquityAlexPercent / 100);
  const cmoEquityAdriel = (adrielClient?.revenue ?? 0) * (month.expenses.cmoEquityAdrielPercent / 100);
  const softwareTotal = month.expenses.software.reduce((sum, s) => sum + (s.amount || 0), 0);
  const bonuses = Math.floor(Math.max(0, totalPortfolioRevenue) / BONUS_TIER_REVENUE) * BONUS_PER_TIER;

  const totalExpenses =
    setterPayroll + closerPayroll + cmoBasePay + cmoEquityAlex + cmoEquityAdriel + bonuses + softwareTotal;

  const netPersonalIncomeUsd = grossPortfolioRevenue - totalExpenses;
  const netPersonalIncomeNzd = netPersonalIncomeUsd * month.fxRateUsdToNzd;

  return {
    totalPortfolioRevenue,
    totalOtherRevenue,
    clientShares,
    clientShareRates,
    totalClientRevenueShare,
    grossPortfolioRevenue,
    setterPayroll,
    closerPayroll,
    cmoBasePay,
    cmoEquityAlex,
    cmoEquityAdriel,
    softwareTotal,
    bonuses,
    totalExpenses,
    netPersonalIncomeUsd,
    netPersonalIncomeNzd,
  };
}

const SOFTWARE_CAP_NZD = 500;
const RENT_NZD = 3000;
const FOOD_NZD = 1500;
const BUSINESS_BANK_SPLIT = 0.7;

export interface CapitalAllocation {
  total: number;
  software: number;
  rent: number;
  food: number;
  businessBank: number;
  checking: number;
}

export function calcCapitalAllocation(netIncomeNzd: number): CapitalAllocation {
  const total = Math.max(0, netIncomeNzd);
  let remaining = total;

  const software = Math.min(SOFTWARE_CAP_NZD, remaining);
  remaining -= software;
  const rent = Math.min(RENT_NZD, remaining);
  remaining -= rent;
  const food = Math.min(FOOD_NZD, remaining);
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
