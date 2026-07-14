"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatCurrency } from "@/lib/format";

type SalaryPlan = {
  income: number;
  essentials: number;
  lifestyle: number;
  savings: number;
  investments: number;
  debtRepayment: number;
  giving: number;
  other: number;
} | null;

type Field = Exclude<keyof NonNullable<SalaryPlan>, "income">;

const fields: Array<{ key: Field; label: string; hint: string; icon: string }> = [
  { key: "essentials", label: "Essential expenses", hint: "Housing, bills, groceries, transport", icon: "🏠" },
  { key: "lifestyle", label: "Lifestyle", hint: "Dining, entertainment, shopping", icon: "✨" },
  { key: "savings", label: "Savings", hint: "Short-term goals and cash reserves", icon: "💧" },
  { key: "investments", label: "Investments", hint: "Long-term investing and retirement", icon: "📈" },
  { key: "debtRepayment", label: "Debt repayment", hint: "Loans and credit-card repayments", icon: "🧾" },
  { key: "giving", label: "Giving", hint: "Family support, gifts, and donations", icon: "🤝" },
  { key: "other", label: "Other goals", hint: "Anything else you want to set aside", icon: "🎯" },
];

function emptyPlan(): NonNullable<SalaryPlan> {
  return { income: 0, essentials: 0, lifestyle: 0, savings: 0, investments: 0, debtRepayment: 0, giving: 0, other: 0 };
}

export function SalaryAllocationPlanner({ month, initialPlan, actualSpent }: { month: string; initialPlan: SalaryPlan; actualSpent: number }) {
  const saveSalaryPlan = useMutation(api.finance.saveSalaryPlan);
  const [plan, setPlan] = useState<NonNullable<SalaryPlan>>(initialPlan ?? emptyPlan());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const allocated = useMemo(
    () => fields.reduce((sum, field) => sum + plan[field.key], 0),
    [plan],
  );
  const remaining = plan.income - allocated;
  const plannedExpenses = plan.essentials + plan.lifestyle;

  function update(key: keyof NonNullable<SalaryPlan>, value: string) {
    const parsed = Number(value);
    setPlan((current) => ({ ...current, [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }));
    setMessage("");
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveSalaryPlan({ month, ...plan });
      setMessage("Saved your monthly allocation plan.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl border border-stone-200 bg-[#fafafa] p-5 lg:grid-cols-[1.2fr_0.8fr]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Monthly take-home salary</span>
          <input type="number" min="0" step="0.01" value={plan.income || ""} onChange={(event) => update("income", event.target.value)} placeholder="0.00" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-2xl font-semibold text-slate-900 outline-none ring-lime-300 focus:ring-2" />
        </label>
        <div className={`rounded-xl border p-4 ${remaining < 0 ? "border-rose-200 bg-rose-50" : "border-lime-300 bg-lime-50"}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Left to allocate</p>
          <p className={`mt-2 text-2xl font-semibold ${remaining < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatCurrency(remaining)}</p>
          <p className="mt-1 text-sm text-slate-600">{remaining < 0 ? "Your planned allocations exceed income." : "Give every dollar a purpose, or leave it available."}</p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="rounded-xl border border-stone-200 bg-white p-4 transition hover:border-lime-300">
            <span className="flex items-start gap-3"><span className="mt-0.5 text-lg">{field.icon}</span><span><span className="block font-semibold text-slate-900">{field.label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{field.hint}</span></span></span>
            <input type="number" min="0" step="0.01" value={plan[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} placeholder="0.00" className="mt-4 w-full rounded-lg border border-stone-200 bg-[#fafafa] px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none ring-lime-300 focus:ring-2" />
          </label>
        ))}
      </div>

      <section className="grid gap-3 rounded-xl border border-stone-200 bg-slate-950 p-5 text-white sm:grid-cols-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Allocated</p><p className="mt-1 text-xl font-semibold">{formatCurrency(allocated)}</p></div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Planned expenses</p><p className="mt-1 text-xl font-semibold">{formatCurrency(plannedExpenses)}</p></div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Actual spending</p><p className="mt-1 text-xl font-semibold">{formatCurrency(actualSpent)}</p></div>
      </section>

      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-xl bg-lime-50 px-4 py-3 text-sm text-slate-800">{message}</p> : null}
      <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-lime-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-lime-200 disabled:opacity-60">{saving ? "Saving…" : "Save monthly plan"}</button>
    </div>
  );
}
