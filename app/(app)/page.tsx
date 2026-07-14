"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionCard, StatCard } from "@/components/ui";
import { currentMonth, useFinanceOverview } from "@/components/use-finance-overview";
import { formatCurrency, formatMonthLabel } from "@/lib/format";

export default function DashboardPage() {
  const [month, setMonth] = useState(() => currentMonth());
  const data = useFinanceOverview(month);

  if (!data) {
    return <p className="text-sm text-slate-500">Loading your private dashboard…</p>;
  }

  const { summary } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">
            {formatMonthLabel(month)} overview
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Know where your money goes
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Track spending and monthly category targets. Only you can access this data.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            View month
            <input
              type="month"
              value={month}
              max={currentMonth()}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <Link
            href="/budgets"
            className="rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Edit budgets
          </Link>
          <Link
            href="/upload"
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Upload statement
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Monthly spent" value={formatCurrency(summary.totalSpent)} hint="Confirmed and imported expenses" />
        <StatCard label="Monthly budget" value={formatCurrency(summary.totalBudget)} hint="Spend targets only" />
        <StatCard
          label="Budget variance"
          value={formatCurrency(Math.abs(summary.totalVariance))}
          hint={summary.totalVariance > 0 ? "Over monthly budget" : "Under monthly budget"}
          tone={summary.totalVariance > 0 ? "danger" : "success"}
        />
      </div>

      <SectionCard title="Spending by category" description="Monthly spend compared to the target you set.">
        <div className="space-y-3">
          {summary.categories
            .filter((category) => category.target > 0 || category.spent > 0)
            .map((category) => (
              <div key={String(category._id)} className="rounded-xl border border-slate-100 p-4">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="font-medium text-slate-900">{category.icon} {category.name}</span>
                  <span className="text-slate-600">{formatCurrency(category.spent)} / {formatCurrency(category.target)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={category.status === "OVER" ? "h-full bg-rose-500" : "h-full bg-emerald-500"}
                    style={{ width: `${Math.min(100, category.target ? (category.spent / category.target) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          {summary.categories.every((category) => category.target === 0 && category.spent === 0) ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Set a target and add transactions to see your progress.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
