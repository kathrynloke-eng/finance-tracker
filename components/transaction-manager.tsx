"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";

type Category = {
  id: string;
  name: string;
};

type Account = {
  id: string;
  name: string;
  type: string;
};

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  accountId: string;
  recurringTransactionId?: string | null;
  category: Category | null;
  account: Account | null;
};

type TransactionManagerProps = {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onChanged?: () => void;
};

type Draft = {
  date: string;
  description: string;
  amount: string;
  accountId: string;
  categoryId: string;
  status: "PENDING_REVIEW" | "CONFIRMED";
};

type InlineCategoryChange = {
  categoryId: string;
  status: Draft["status"];
};

function toDateInput(value: string) {
  return format(new Date(value), "yyyy-MM-dd");
}

function emptyDraft(accountId: string): Draft {
  return {
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    amount: "",
    accountId,
    categoryId: "",
    status: "CONFIRMED",
  };
}

function draftFromTransaction(transaction: Transaction): Draft {
  return {
    date: toDateInput(transaction.date),
    description: transaction.description,
    amount: String(transaction.amount),
    accountId: transaction.accountId,
    categoryId: transaction.category?.id ?? "",
    status: transaction.status === "PENDING_REVIEW" ? "PENDING_REVIEW" : "CONFIRMED",
  };
}

export function TransactionManager({
  transactions: initialTransactions,
  categories,
  accounts,
  onChanged,
}: TransactionManagerProps) {
  const defaultAccountId = accounts[0]?.id ?? "";
  const [transactions, setTransactions] = useState(initialTransactions);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(() => emptyDraft(defaultAccountId));
  const [filter, setFilter] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [inlineCategoryChanges, setInlineCategoryChanges] = useState<Record<string, InlineCategoryChange>>({});

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((transaction) => {
      const haystack = [
        transaction.description,
        transaction.category?.name ?? "",
        transaction.account?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [transactions, filter]);

  const filteredIds = useMemo(
    () => filtered.map((transaction) => transaction.id),
    [filtered],
  );
  const selectedCount = filteredIds.filter((id) => selectedIds.has(id)).length;
  const allFilteredSelected =
    filteredIds.length > 0 && selectedCount === filteredIds.length;
  const changedInlineIds = useMemo(
    () => transactions
      .filter((transaction) => {
        const change = inlineCategoryChanges[transaction.id];
        return change && (change.categoryId !== (transaction.category?.id ?? "") || change.status !== transaction.status);
      })
      .map((transaction) => transaction.id),
    [inlineCategoryChanges, transactions],
  );
  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }

  function stageInlineCategory(transaction: Transaction, categoryId: string) {
    const ids = selectedIds.has(transaction.id)
      ? [...selectedIds]
      : [transaction.id];
    setInlineCategoryChanges((current) => {
      const next = { ...current };
      for (const id of ids) {
        next[id] = { categoryId, status: "CONFIRMED" };
      }
      return next;
    });
    setMessage("");
    setError("");
  }

  async function saveInlineCategories() {
    const updates = transactions
      .filter((transaction) => changedInlineIds.includes(transaction.id))
      .map((transaction) => ({
        id: transaction.id,
        ...draftFromTransaction(transaction),
        ...inlineCategoryChanges[transaction.id],
      }));
    if (updates.length === 0) return;

    setBusyId("inline-save");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: updates.map((update) => ({ ...update, amount: Number(update.amount), categoryId: update.categoryId || null })) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not save category changes.");
      const updated = new Map<string, Transaction>((data.transactions ?? []).map((item: Transaction) => [item.id, item]));
      setTransactions((current) => current.map((transaction) => updated.get(transaction.id) ?? transaction));
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const update of updates) next.delete(update.id);
        return next;
      });
      setInlineCategoryChanges({});
      setMessage(`Saved ${updates.length} category update${updates.length === 1 ? "" : "s"}.`);
      onChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save category changes.");
    } finally {
      setBusyId(null);
    }
  }

  async function createTransaction(event: React.FormEvent) {
    event.preventDefault();
    setBusyId("new");
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: addDraft.date,
          description: addDraft.description,
          amount: Number(addDraft.amount),
          accountId: addDraft.accountId,
          categoryId: addDraft.categoryId || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not add transaction.");
      }

      const created = {
        id: data.transaction.id,
        date: data.transaction.date,
        description: data.transaction.description,
        amount: data.transaction.amount,
        status: data.transaction.status,
        accountId: data.transaction.accountId,
        category: data.transaction.category,
        account: data.transaction.account,
      } as Transaction;

      setTransactions((current) => [created, ...current]);
      setAddDraft(emptyDraft(defaultAccountId));
      setShowAdd(false);
      setMessage(`Added “${created.description}”.`);
      onChanged?.();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Add failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(transaction: Transaction) {
    setEditingId(transaction.id);
    setEditDraft(draftFromTransaction(transaction));
    setMessage("");
    setError("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingId || !editDraft) return;

    setBusyId(editingId);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          date: editDraft.date,
          description: editDraft.description,
          amount: Number(editDraft.amount),
          accountId: editDraft.accountId,
          categoryId: editDraft.categoryId || null,
          status: "CONFIRMED",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not update transaction.");
      }

      setTransactions((current) =>
        current
          .map((transaction) =>
            transaction.id === editingId
              ? {
                  id: data.transaction.id,
                  date: data.transaction.date,
                  description: data.transaction.description,
                  amount: data.transaction.amount,
                  status: data.transaction.status,
                  accountId: data.transaction.accountId,
                  category: data.transaction.category,
                  account: data.transaction.account,
                }
              : transaction,
          )
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
      );
      setEditingId(null);
      setEditDraft(null);
      setMessage(`Updated “${data.transaction.description}”.`);
      onChanged?.();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Update failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const transaction = pendingDelete;

    setBusyId(transaction.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/transactions?id=${transaction.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 404) {
        throw new Error(data.error ?? "Could not delete transaction.");
      }

      setTransactions((current) =>
        current.filter((item) => item.id !== transaction.id),
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(transaction.id);
        return next;
      });
      if (editingId === transaction.id) {
        setEditingId(null);
        setEditDraft(null);
      }
      setPendingDelete(null);
      setMessage(`Deleted “${transaction.description}”.`);
      onChanged?.();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Delete failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmBulkDelete() {
    const ids = filteredIds.filter((id) => selectedIds.has(id));
    if (ids.length === 0) {
      setPendingBulkDelete(false);
      return;
    }

    setBusyId("bulk");
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 404) {
        throw new Error(data.error ?? "Could not delete transactions.");
      }

      const idSet = new Set(ids);
      setTransactions((current) =>
        current.filter((item) => !idSet.has(item.id)),
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      });
      if (editingId && idSet.has(editingId)) {
        setEditingId(null);
        setEditDraft(null);
      }
      setPendingBulkDelete(false);
      setMessage(
        `Deleted ${data.deletedCount ?? ids.length} transaction${
          (data.deletedCount ?? ids.length) === 1 ? "" : "s"
        }.`,
      );
      onChanged?.();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Delete failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search description, category, or account"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-emerald-500 focus:ring-2 sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setPendingBulkDelete(true);
                setPendingDelete(null);
                setError("");
                setMessage("");
              }}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Delete selected ({selectedCount})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setShowAdd((current) => {
                if (current) {
                  setAddDraft(emptyDraft(defaultAccountId));
                }
                return !current;
              });
              setError("");
              setMessage("");
            }}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {showAdd ? "Cancel" : "Add transaction"}
          </button>
        </div>
      </div>

      {showAdd ? (
        <form
          onSubmit={createTransaction}
          className="grid gap-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 md:grid-cols-2"
        >
          <p className="md:col-span-2 text-sm font-medium text-slate-800">
            Add a transaction manually
          </p>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Date
            </span>
            <input
              type="date"
              required
              value={addDraft.date}
              onChange={(event) =>
                setAddDraft((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Amount (negative = expense)
            </span>
            <input
              type="text"
              inputMode="decimal"
              required
              value={addDraft.amount}
              placeholder="-12.50"
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                setAddDraft((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Description
            </span>
            <input
              type="text"
              required
              value={addDraft.description}
              onChange={(event) =>
                setAddDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="e.g. Grocery store"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Account
            </span>
            <select
              required
              value={addDraft.accountId}
              onChange={(event) =>
                setAddDraft((current) => ({
                  ...current,
                  accountId: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Category
            </span>
            <select
              value={addDraft.categoryId}
              onChange={(event) =>
                setAddDraft((current) => ({
                  ...current,
                  categoryId: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            >
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busyId === "new"}
            className="md:col-span-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busyId === "new" ? "Saving..." : "Add transaction"}
          </button>
        </form>
      ) : null}

      {pendingBulkDelete ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-950">
            Delete {selectedCount} selected transaction
            {selectedCount === 1 ? "" : "s"}?
          </p>
          <p className="mt-1 text-sm text-amber-800">
            This removes them from budgets and transfer calculations.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmBulkDelete}
              disabled={busyId === "bulk"}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {busyId === "bulk" ? "Deleting..." : "Yes, delete selected"}
            </button>
            <button
              type="button"
              onClick={() => setPendingBulkDelete(false)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No transactions yet. Add one manually or upload a PDF statement.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAllFiltered}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Select all shown ({filtered.length})
            </label>
            {selectedCount > 0 ? (
              <p className="text-xs font-medium text-slate-500">
                {selectedCount} selected
              </p>
            ) : null}
          </div>

          {selectedCount > 1 ? (
            <div className="sticky bottom-3 z-10 flex flex-col gap-2 border-b border-emerald-200 bg-emerald-50 p-3 shadow-lg sm:flex-row sm:items-center">
              <p className="text-sm text-emerald-950"><strong>{selectedCount} selected.</strong> Choose a category in any selected row to stage it for all of them.</p>
            </div>
          ) : null}

          {changedInlineIds.length > 0 ? (
            <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-sky-200 bg-sky-50 p-3 shadow-lg">
              <p className="text-sm font-semibold text-sky-950">{changedInlineIds.length} category update{changedInlineIds.length === 1 ? "" : "s"} ready</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setInlineCategoryChanges({})} disabled={busyId === "inline-save"} className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-800 disabled:opacity-60">Cancel</button>
                <button type="button" onClick={() => void saveInlineCategories()} disabled={busyId === "inline-save"} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busyId === "inline-save" ? "Saving..." : "Save changes"}</button>
              </div>
            </div>
          ) : null}

          {filtered.map((transaction) => {
            const isEditing = editingId === transaction.id && editDraft;
            const inlineChange = inlineCategoryChanges[transaction.id];
            const categoryId = inlineChange?.categoryId ?? transaction.category?.id ?? "";

            if (isEditing && editDraft) {
              return (
                <form
                  key={transaction.id}
                  onSubmit={saveEdit}
                  className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 md:grid-cols-2"
                >
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      Date
                    </span>
                    <input
                      type="date"
                      required
                      value={editDraft.date}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current
                            ? { ...current, date: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      Amount
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={editDraft.amount}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current
                            ? { ...current, amount: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
                    />
                  </label>
                  <label className="text-sm md:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      Description
                    </span>
                    <input
                      type="text"
                      required
                      value={editDraft.description}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current
                            ? { ...current, description: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      Account
                    </span>
                    <select
                      required
                      value={editDraft.accountId}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current
                            ? { ...current, accountId: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      Category
                    </span>
                    <select
                      value={editDraft.categoryId}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current
                            ? { ...current, categoryId: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={busyId === transaction.id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {busyId === transaction.id ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft(null);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={transaction.id}
                className={`border-b border-slate-100 px-3 py-3 last:border-b-0 sm:px-4 ${
                  pendingDelete?.id === transaction.id
                    ? "border-amber-200 bg-amber-50/60"
                    : selectedIds.has(transaction.id)
                      ? "border-emerald-200 bg-emerald-50/30"
                      : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(transaction.id)}
                      onChange={() => toggleSelected(transaction.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      aria-label={`Select ${transaction.description}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {transaction.description}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {format(new Date(transaction.date), "MMM d, yyyy")}
                        {transaction.account
                          ? ` · ${transaction.account.name}`
                          : ""}
                      </p>
                      <select aria-label={`Category for ${transaction.description}`} value={categoryId} onChange={(event) => stageInlineCategory(transaction, event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none ring-emerald-500 focus:ring-2 sm:w-48">
                        <option value="">Uncategorized</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(transaction.amount)}
                    </p>
                    {transaction.recurringTransactionId ? (
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                        Recurring
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        transaction.status === "CONFIRMED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {transaction.status === "CONFIRMED"
                        ? "Reviewed"
                        : transaction.category
                          ? "Suggested"
                          : "Needs category"}
                    </span>
                    {transaction.status === "PENDING_REVIEW" && transaction.category ? (
                      <button type="button" disabled={busyId === "inline-save"} onClick={() => stageInlineCategory(transaction, transaction.category?.id ?? "")} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-60">
                        Accept
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startEdit(transaction)}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === transaction.id}
                      onClick={() => {
                        setPendingDelete(transaction);
                        setPendingBulkDelete(false);
                        setError("");
                        setMessage("");
                      }}
                      className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {pendingDelete?.id === transaction.id ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-sm font-medium text-amber-950">
                      Delete “{transaction.description}”?
                    </p>
                    <p className="mt-1 text-sm text-amber-800">
                      This removes it from budgets and transfer calculations.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={confirmDelete}
                        disabled={busyId === transaction.id}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        {busyId === transaction.id
                          ? "Deleting..."
                          : "Yes, delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
