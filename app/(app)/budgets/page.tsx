"use client";

import { BudgetEditor } from "@/components/budget-editor";
import { SectionCard } from "@/components/ui";
import { currentMonth, useFinanceOverview } from "@/components/use-finance-overview";
import { formatMonthLabel } from "@/lib/format";

export default function BudgetsPage() {
  const month = currentMonth();
  const data = useFinanceOverview(month);
  if (!data) return <p className="text-sm text-slate-500">Loading your budgets…</p>;
  const initialBudgets = Object.fromEntries(data.budgets.map((budget) => [String(budget.categoryId), budget.targetAmount]));
  return <div className="space-y-8"><div><p className="text-sm font-medium text-emerald-700">{formatMonthLabel(month)}</p><h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Monthly category targets</h2><p className="mt-2 max-w-2xl text-slate-600">Set how much you plan to spend each month, or mark a category as a reserve.</p></div><SectionCard title="Set target expenses" description="Add custom categories and set monthly targets."><BudgetEditor month={month} categories={data.categories.map((category) => ({ ...category, id: String(category._id) }))} initialBudgets={initialBudgets} /></SectionCard></div>;
}
