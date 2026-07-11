"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { format } from "date-fns";

type Category = {
  id: string;
  name: string;
};

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  category: Category | null;
};

type TransactionReviewProps = {
  transactions: Transaction[];
  categories: Category[];
};

export function TransactionReview({
  transactions: initialTransactions,
  categories,
}: TransactionReviewProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [message, setMessage] = useState("");

  async function updateTransaction(
    id: string,
    categoryId: string,
  ) {
    setMessage("");

    const response = await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, categoryId, status: "CONFIRMED" }),
    });

    if (!response.ok) {
      setMessage("Could not update transaction.");
      return;
    }

    const data = await response.json();
    const category = categories.find((item) => item.id === categoryId) ?? null;

    setTransactions((current) =>
      current.map((transaction) =>
        transaction.id === id
          ? {
              ...transaction,
              category,
              status: "CONFIRMED",
            }
          : transaction,
      ),
    );

    setMessage(`Updated category for ${data.transaction.description}.`);
  }

  if (transactions.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No transactions yet. Upload a PDF statement to get started.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className="grid gap-3 rounded-xl border border-slate-100 p-4 md:grid-cols-[1.2fr_1fr_auto_auto]"
        >
          <div>
            <p className="font-medium text-slate-900">{transaction.description}</p>
            <p className="text-sm text-slate-500">
              {format(new Date(transaction.date), "MMM d, yyyy")}
            </p>
          </div>
          <select
            value={transaction.category?.id ?? ""}
            onChange={(event) =>
              updateTransaction(transaction.id, event.target.value)
            }
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
          >
            <option value="" disabled>
              Choose category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <p className="self-center text-sm font-semibold text-slate-900">
            {formatCurrency(transaction.amount)}
          </p>
          <span
            className={`self-center rounded-full px-2.5 py-1 text-xs font-medium ${
              transaction.status === "CONFIRMED"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {transaction.status === "CONFIRMED" ? "Confirmed" : "Review"}
          </span>
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
