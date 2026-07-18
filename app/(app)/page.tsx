"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionCard, StatCard } from "@/components/ui";
import { ReserveReviewPrompt } from "@/components/reserve-review-prompt";
import { currentMonth, useFinanceOverview } from "@/components/use-finance-overview";
import { formatCurrency, formatMonthLabel } from "@/lib/format";

export default function DashboardPage() {
  const [month, setMonth] = useState(() => currentMonth());
  const [mobileSection, setMobileSection] = useState<"overview" | "reserve" | "spending">("overview");
  const data = useFinanceOverview(month);

  if (!data) {
    return <p className="text-sm text-slate-500">Loading your private dashboard…</p>;
  }

  const { summary } = data;
  const hasBudget = summary.totalBudget > 0;
  const spendPercentage = hasBudget
    ? Math.min(100, (summary.totalSpent / summary.totalBudget) * 100)
    : 0;
  const isOverBudget = summary.totalVariance > 0;
  const reserveCategories = summary.categories.filter(
    (category) => category.budgetStyle === "RESERVE",
  );
  const reserveTarget = reserveCategories.reduce(
    (total, category) => total + category.target,
    0,
  );
  const reserveRecorded = reserveCategories.reduce(
    (total, category) => total + category.spent,
    0,
  );
  const reserveRemaining = Math.max(0, reserveTarget - reserveRecorded);
  const showOnMobile = (section: "overview" | "reserve" | "spending") =>
    mobileSection === section ? "block" : "hidden sm:block";
  const updateMonth = (value: string) => {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) setMonth(value);
  };

  return (
    <div className="space-y-5 pb-4 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-5 py-6 text-white shadow-xl shadow-emerald-950/15 sm:px-8 sm:py-9">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-lime-300/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-lime-100">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-300" />
              Private monthly overview
            </div>
            <p className="mt-5 text-sm font-medium text-lime-200">
              {formatMonthLabel(month)}
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              A calmer view of your money.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Review your monthly spending, compare it with your targets, and keep your financial history in one private place.
            </p>
          </div>

          <div className="flex w-full flex-wrap items-end gap-2 lg:w-auto">
            <label className="flex min-w-36 flex-1 flex-col gap-1.5 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur lg:flex-none">
              View month
              <input
                type="month"
                value={month}
                max={currentMonth()}
                onChange={(event) => updateMonth(event.target.value)}
                onInput={(event) => updateMonth(event.currentTarget.value)}
                className="bg-transparent text-sm font-semibold text-white outline-none [color-scheme:dark]"
              />
            </label>
            <Link
              href="/budgets"
              className="flex-1 rounded-xl bg-lime-300 px-4 py-3 text-center text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-lime-200 lg:flex-none"
            >
              Edit budgets
            </Link>
            <Link
              href="/transactions"
              className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/20 lg:flex-none"
            >
              Add transactions
            </Link>
          </div>
        </div>
      </section>

      <ReserveReviewPrompt key={data.dueReserveSchedules.map((schedule) => `${schedule._id}:${schedule.suggestedAmount}`).join("|")} schedules={data.dueReserveSchedules.map((schedule) => ({ ...schedule, _id: String(schedule._id), amount: schedule.suggestedAmount }))} />

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard compact label="Monthly spent" value={formatCurrency(summary.totalSpent)} hint="Confirmed and imported expenses" />
        <StatCard compact label="Monthly budget" value={formatCurrency(summary.totalBudget)} hint="Spend targets for this month" tone="success" />
        <StatCard
          compact
          label="Budget variance"
          value={formatCurrency(Math.abs(summary.totalVariance))}
          hint={isOverBudget ? "Over monthly budget" : "Remaining in your budget"}
          tone={isOverBudget ? "danger" : "success"}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:hidden" role="tablist" aria-label="Dashboard sections">
        {[
          ["overview", "Overview"],
          ["reserve", "Reserves"],
          ["spending", "Spending"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mobileSection === id}
            onClick={() => setMobileSection(id as "overview" | "reserve" | "spending")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${mobileSection === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className={`${showOnMobile("overview")} rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Budget health</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              {hasBudget
                ? isOverBudget
                  ? "You are above this month’s target"
                  : "You are within this month’s target"
                : "Set a budget to track your progress"}
            </h3>
          </div>
          {hasBudget ? (
            <p className={`text-sm font-semibold ${isOverBudget ? "text-rose-600" : "text-emerald-700"}`}>
              {Math.round((summary.totalSpent / summary.totalBudget) * 100)}% of budget used
            </p>
          ) : (
            <Link href="/budgets" className="text-sm font-semibold text-slate-800 underline decoration-lime-300 decoration-2 underline-offset-4 hover:text-slate-950">
              Add a monthly target →
            </Link>
          )}
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100" aria-label="Budget used">
          <div
            className={`h-full rounded-full transition-all ${isOverBudget ? "bg-rose-500" : "bg-emerald-500"}`}
            style={{ width: `${spendPercentage}%` }}
          />
        </div>
      </section>

      <div className={showOnMobile("reserve")}>
        <SectionCard
          title="Reserve"
          description="Monthly amounts you have set aside for future needs and goals."
          action={
            <Link
              href="/budgets"
              className="text-sm font-semibold text-slate-800 underline decoration-lime-300 decoration-2 underline-offset-4 hover:text-slate-950"
            >
              Manage reserves →
            </Link>
          }
        >
        {reserveCategories.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-lime-200 bg-lime-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Planned</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(reserveTarget)}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recorded</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(reserveRecorded)}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Left to set aside</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(reserveRemaining)}</p>
              </div>
            </div>
            <div className="space-y-3">
              {reserveCategories.map((category) => {
                const progress = category.target
                  ? Math.min(100, (category.spent / category.target) * 100)
                  : 0;
                return (
                  <div key={String(category._id)} className="rounded-xl border border-stone-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4 text-sm">
                      <span className="font-semibold text-slate-900">{category.icon} {category.name}</span>
                      <span className="whitespace-nowrap font-medium text-slate-600">
                        {formatCurrency(category.spent)} <span className="text-slate-400">of</span> {formatCurrency(category.target)}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${category.name} reserve progress`}>
                      <div className="h-full rounded-full bg-lime-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-9 text-center">
            <p className="text-sm font-medium text-slate-700">No reserves for this month yet.</p>
            <p className="mt-1 text-sm text-slate-500">Create a category with the Reserve type to start setting money aside.</p>
          </div>
        )}
        </SectionCard>
      </div>

      <div className={showOnMobile("spending")}>
      <SectionCard title="Spending by category" description="Monthly spending compared with the target you set.">
        <div className="space-y-3">
          {summary.categories
            .filter((category) => category.budgetStyle === "MONTHLY")
            .filter((category) => category.target > 0 || category.spent > 0)
            .map((category) => {
              const percentage = category.target
                ? Math.min(100, (category.spent / category.target) * 100)
                : 0;
              return (
                <div key={String(category._id)} className="rounded-xl border border-stone-200 bg-[#fafafa] p-4 transition hover:border-lime-300 hover:bg-lime-50/40">
                  <div className="flex items-start justify-between gap-4 text-sm">
                    <span className="font-semibold text-slate-900">{category.icon} {category.name}</span>
                    <span className="whitespace-nowrap font-medium text-slate-600">
                      {formatCurrency(category.spent)} <span className="text-slate-400">of</span> {formatCurrency(category.target)}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white" aria-label={`${category.name} spending progress`}>
                    <div
                      className={`h-full rounded-full ${category.status === "OVER" ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          {summary.categories
            .filter((category) => category.budgetStyle === "MONTHLY")
            .every((category) => category.target === 0 && category.spent === 0) ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">Your monthly overview will appear here.</p>
              <p className="mt-1 text-sm text-slate-500">Set a target and add transactions to see your progress.</p>
            </div>
          ) : null}
        </div>
      </SectionCard>
      </div>
    </div>
  );
}
