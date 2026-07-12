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

type Recurring = {
  id: string;
  description: string;
  amount: number;
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  startDate: string;
  endDate: string | null;
  nextOccurrence: string;
  isActive: boolean;
  accountId: string;
  categoryId: string | null;
  category: Category | null;
  account: Account | null;
};

type Draft = {
  description: string;
  amount: string;
  frequency: Recurring["frequency"];
  interval: string;
  startDate: string;
  endDate: string;
  accountId: string;
  categoryId: string;
};

type RecurringManagerProps = {
  recurring: Recurring[];
  categories: Category[];
  accounts: Account[];
  onChanged?: () => void;
};

const FREQUENCY_LABELS: Record<Recurring["frequency"], string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

function toDateInput(value: string) {
  return format(new Date(value), "yyyy-MM-dd");
}

function emptyDraft(accountId: string): Draft {
  return {
    description: "",
    amount: "",
    frequency: "MONTHLY",
    interval: "1",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    accountId,
    categoryId: "",
  };
}

function draftFromRecurring(rule: Recurring): Draft {
  return {
    description: rule.description,
    amount: String(rule.amount),
    frequency: rule.frequency,
    interval: String(rule.interval),
    startDate: toDateInput(rule.startDate),
    endDate: rule.endDate ? toDateInput(rule.endDate) : "",
    accountId: rule.accountId,
    categoryId: rule.categoryId ?? "",
  };
}

function cadenceLabel(rule: Pick<Recurring, "frequency" | "interval">) {
  const base = FREQUENCY_LABELS[rule.frequency].toLowerCase();
  if (rule.interval === 1) return FREQUENCY_LABELS[rule.frequency];
  return `Every ${rule.interval} ${base.replace("ly", "")}s`;
}

export function RecurringManager({
  recurring: initialRecurring,
  categories,
  accounts,
  onChanged,
}: RecurringManagerProps) {
  const defaultAccountId = accounts[0]?.id ?? "";
  const [rules, setRules] = useState(initialRecurring);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(() =>
    emptyDraft(defaultAccountId),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Recurring | null>(null);

  const sorted = useMemo(
    () =>
      [...rules].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return (
          new Date(a.nextOccurrence).getTime() -
          new Date(b.nextOccurrence).getTime()
        );
      }),
    [rules],
  );

  async function createRule(event: React.FormEvent) {
    event.preventDefault();
    setBusyId("new");
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/recurring-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: addDraft.description,
          amount: Number(addDraft.amount),
          frequency: addDraft.frequency,
          interval: Number(addDraft.interval),
          startDate: addDraft.startDate,
          endDate: addDraft.endDate || null,
          accountId: addDraft.accountId,
          categoryId: addDraft.categoryId || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not create recurring transaction.");
      }

      setRules((current) => [data.recurring as Recurring, ...current]);
      setAddDraft(emptyDraft(defaultAccountId));
      setShowAdd(false);
      const createdCount =
        typeof data.createdCount === "number" ? data.createdCount : 0;
      setMessage(
        createdCount > 0
          ? `Added “${data.recurring.description}” and posted ${createdCount} due transaction${createdCount === 1 ? "" : "s"}.`
          : `Added “${data.recurring.description}”.`,
      );
      onChanged?.();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Create failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(rule: Recurring) {
    setEditingId(rule.id);
    setEditDraft(draftFromRecurring(rule));
    setPendingDelete(null);
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
      const response = await fetch("/api/recurring-transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          description: editDraft.description,
          amount: Number(editDraft.amount),
          frequency: editDraft.frequency,
          interval: Number(editDraft.interval),
          startDate: editDraft.startDate,
          endDate: editDraft.endDate || null,
          accountId: editDraft.accountId,
          categoryId: editDraft.categoryId || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not update recurring transaction.");
      }

      setRules((current) =>
        current.map((rule) =>
          rule.id === editingId ? (data.recurring as Recurring) : rule,
        ),
      );
      setEditingId(null);
      setEditDraft(null);
      setMessage(`Updated “${data.recurring.description}”.`);
      onChanged?.();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Update failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(rule: Recurring) {
    setBusyId(rule.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/recurring-transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rule.id,
          isActive: !rule.isActive,
          ...( !rule.isActive
            ? { nextOccurrence: toDateInput(rule.nextOccurrence) }
            : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not update status.");
      }

      setRules((current) =>
        current.map((item) =>
          item.id === rule.id ? (data.recurring as Recurring) : item,
        ),
      );
      setMessage(
        data.recurring.isActive
          ? `Resumed “${data.recurring.description}”.`
          : `Paused “${data.recurring.description}”.`,
      );
      onChanged?.();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "Update failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const rule = pendingDelete;

    setBusyId(rule.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/recurring-transactions?id=${rule.id}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 404) {
        throw new Error(data.error ?? "Could not delete recurring transaction.");
      }

      setRules((current) => current.filter((item) => item.id !== rule.id));
      if (editingId === rule.id) {
        setEditingId(null);
        setEditDraft(null);
      }
      setPendingDelete(null);
      setMessage(
        `Deleted template “${rule.description}”. Existing posted transactions were kept.`,
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

  function renderDraftFields(
    draft: Draft,
    setDraft: (updater: (current: Draft) => Draft) => void,
  ) {
    return (
      <>
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Description
          </span>
          <input
            type="text"
            required
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="e.g. Netflix subscription"
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
            value={draft.amount}
            placeholder="-15.99"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Frequency
          </span>
          <select
            value={draft.frequency}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                frequency: event.target.value as Recurring["frequency"],
              }))
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
          >
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Every
          </span>
          <input
            type="number"
            min={1}
            max={52}
            required
            value={draft.interval}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                interval: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Start date
          </span>
          <input
            type="date"
            required
            value={draft.startDate}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                startDate: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            End date (optional)
          </span>
          <input
            type="date"
            value={draft.endDate}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                endDate: event.target.value,
              }))
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
            value={draft.accountId}
            onChange={(event) =>
              setDraft((current) => ({
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
            value={draft.categoryId}
            onChange={(event) =>
              setDraft((current) => ({
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
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Templates post automatically when their next date is due.
        </p>
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
          {showAdd ? "Cancel" : "Add recurring"}
        </button>
      </div>

      {showAdd ? (
        <form
          onSubmit={createRule}
          className="grid gap-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 md:grid-cols-2"
        >
          <p className="md:col-span-2 text-sm font-medium text-slate-800">
            New recurring transaction
          </p>
          {renderDraftFields(addDraft, (updater) =>
            setAddDraft((current) => updater(current)),
          )}
          <button
            type="submit"
            disabled={busyId === "new"}
            className="md:col-span-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busyId === "new" ? "Saving..." : "Add recurring"}
          </button>
        </form>
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

      {sorted.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No recurring transactions yet. Add rent, salary, or subscriptions
          here.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((rule) => {
            const isEditing = editingId === rule.id && editDraft;

            if (isEditing && editDraft) {
              return (
                <form
                  key={rule.id}
                  onSubmit={saveEdit}
                  className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 md:grid-cols-2"
                >
                  {renderDraftFields(editDraft, (updater) =>
                    setEditDraft((current) =>
                      current ? updater(current) : current,
                    ),
                  )}
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={busyId === rule.id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {busyId === rule.id ? "Saving..." : "Save changes"}
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
                key={rule.id}
                className={`rounded-xl border p-4 ${
                  pendingDelete?.id === rule.id
                    ? "border-amber-200 bg-amber-50/60"
                    : rule.isActive
                      ? "border-slate-100"
                      : "border-slate-100 bg-slate-50 opacity-80"
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {rule.description}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {cadenceLabel(rule)}
                      {rule.account ? ` · ${rule.account.name}` : ""}
                      {rule.category
                        ? ` · ${rule.category.name}`
                        : " · Uncategorized"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {rule.isActive
                        ? `Next: ${format(new Date(rule.nextOccurrence), "MMM d, yyyy")}`
                        : "Paused"}
                      {rule.endDate
                        ? ` · Ends ${format(new Date(rule.endDate), "MMM d, yyyy")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(rule.amount)}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        rule.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {rule.isActive ? "Active" : "Paused"}
                    </span>
                    <button
                      type="button"
                      disabled={busyId === rule.id}
                      onClick={() => toggleActive(rule)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-60"
                    >
                      {rule.isActive ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(rule)}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === rule.id}
                      onClick={() => {
                        setPendingDelete(rule);
                        setError("");
                        setMessage("");
                      }}
                      className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {pendingDelete?.id === rule.id ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-sm font-medium text-amber-950">
                      Delete template “{rule.description}”?
                    </p>
                    <p className="mt-1 text-sm text-amber-800">
                      Posted transactions stay in your history. Only the
                      schedule is removed.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={confirmDelete}
                        disabled={busyId === rule.id}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        {busyId === rule.id ? "Deleting..." : "Yes, delete"}
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
