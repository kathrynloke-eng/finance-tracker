"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

type Category = {
  id: string;
  name: string;
  icon?: string | null;
};

type BudgetEditorProps = {
  month: string;
  categories: Category[];
  initialBudgets: Record<string, number>;
};

export function BudgetEditor({
  month,
  categories,
  initialBudgets,
}: BudgetEditorProps) {
  const [budgets, setBudgets] = useState(initialBudgets);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function saveBudget(categoryId: string) {
    const targetAmount = budgets[categoryId] ?? 0;
    setSavingId(categoryId);
    setMessage("");

    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, month, targetAmount }),
      });

      if (!response.ok) {
        throw new Error("Failed to save budget.");
      }

      setMessage(`Saved ${formatCurrency(targetAmount)} target.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSavingId(null);
    }
  }

  const expenseCategories = categories.filter(
    (category) =>
      !["Income", "Transfer", "Uncategorized"].includes(category.name),
  );

  return (
    <div className="space-y-4">
      {expenseCategories.map((category) => (
        <div
          key={category.id}
          className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{category.icon ?? "📁"}</span>
            <p className="font-medium text-slate-900">{category.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={budgets[category.id] ?? 0}
              onChange={(event) =>
                setBudgets((current) => ({
                  ...current,
                  [category.id]: Number(event.target.value),
                }))
              }
              className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
            <button
              type="button"
              onClick={() => saveBudget(category.id)}
              disabled={savingId === category.id}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {savingId === category.id ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ))}

      {message ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
