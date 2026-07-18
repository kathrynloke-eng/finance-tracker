"use client";

import { useState } from "react";
import { SalaryAllocationPlanner } from "@/components/salary-allocation-planner";
import { currentMonth, useFinanceOverview } from "@/components/use-finance-overview";
import { formatMonthLabel } from "@/lib/format";

export default function AllocationPage() {
  const [month, setMonth] = useState(() => currentMonth());
  const data = useFinanceOverview(month);
  if (!data) return <p className="text-sm text-slate-500">Loading your allocation plan…</p>;

  return <div className="space-y-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-slate-500">{formatMonthLabel(month)}</p><h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Salary allocation</h2><p className="mt-2 max-w-2xl text-slate-600">Create your own monthly salary plan. This plan is separate from transaction and budget tracking.</p></div><label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Plan month<input type="month" value={month} max={currentMonth()} onChange={(event) => setMonth(event.target.value)} className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none ring-lime-300 focus:ring-2" /></label></div><SalaryAllocationPlanner key={month} month={month} initialPlan={data.salaryPlan ? { income: data.salaryPlan.income, essentials: data.salaryPlan.essentials, lifestyle: data.salaryPlan.lifestyle, savings: data.salaryPlan.savings, investments: data.salaryPlan.investments, debtRepayment: data.salaryPlan.debtRepayment, giving: data.salaryPlan.giving, other: data.salaryPlan.other, allocationLabels: data.salaryPlan.allocationLabels } : null} /></div>;
}
