'use client';

import { useState } from 'react';
import TopBar from './components/TopBar';
import PnLStatement from './components/PnLStatement';
import IncomeTrendChart from './components/IncomeTrendChart';
import CapitalAllocationChart from './components/CapitalAllocationChart';
import { useAppData } from './lib/storage';
import { calcTotals, currentMonthKey, shiftMonthKey } from './lib/calculations';
import type { CapitalAllocationCategory } from './lib/types';

export default function AccountingApp() {
  const { data, setData, updateMonth, getMonth } = useAppData();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());

  const month = getMonth(selectedMonth);
  const monthsWithData = Object.keys(data.months);
  const netProfit = calcTotals(month).netProfit;

  const handleAddMonth = () => {
    const latestKnown = [shiftMonthKey(currentMonthKey(), 1), ...monthsWithData].reduce((max, k) => (k > max ? k : max));
    const newKey = shiftMonthKey(latestKnown, 1);
    updateMonth(newKey, (m) => m);
    setSelectedMonth(newKey);
  };

  const updateCapitalCategories = (
    updater: (categories: CapitalAllocationCategory[]) => CapitalAllocationCategory[],
  ) => {
    setData((prev) => ({ ...prev, capitalCategories: updater(prev.capitalCategories) }));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
        monthsWithData={monthsWithData}
        onAddMonth={handleAddMonth}
      />

      <main className="max-w-[1600px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <PnLStatement month={month} onChange={(updater) => updateMonth(selectedMonth, updater)} />

          <div className="space-y-6">
            <IncomeTrendChart
              getMonth={getMonth}
              monthsWithData={monthsWithData}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
            />
            <CapitalAllocationChart
              netProfit={netProfit}
              categories={data.capitalCategories}
              onChange={updateCapitalCategories}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
