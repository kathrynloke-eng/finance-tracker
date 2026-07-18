"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  type: "CHECKING" | "SAVINGS" | "CREDIT_CARD";
  isTransferSource: boolean;
  hasTransactions: boolean;
  hasStatements: boolean;
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  fundingAccountId: string | null;
};

type FundingPlan = {
  month: string;
  sourceAccount: { id: string; name: string; type: string } | null;
  unassigned: {
    spentAmount: number;
    budgetAmount: number;
    categories: Array<{
      categoryId: string;
      categoryName: string;
      icon: string | null;
      spent: number;
      budget: number;
    }>;
  };
  accounts: Array<{
    accountId: string;
    accountName: string;
    accountType: string;
    spentAmount: number;
    budgetAmount: number;
    categories: Array<{
      categoryId: string;
      categoryName: string;
      icon: string | null;
      spent: number;
      budget: number;
    }>;
  }>;
  transfers: Array<{
    fromAccountId: string;
    fromAccountName: string;
    toAccountId: string;
    toAccountName: string;
    amount: number;
    categoryNames: string[];
  }>;
};

type AccountsManagerProps = {
  initialAccounts: Account[];
  initialCategories: Category[];
  initialPlan: FundingPlan;
};

const SYSTEM_NAMES = new Set(["Income", "Transfer", "Uncategorized"]);

const TYPE_LABELS: Record<Account["type"], string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT_CARD: "Credit card",
};

function usableCategories(list: Category[]) {
  return list
    .filter((category) => !SYSTEM_NAMES.has(category.name))
    .map((category) => ({
      ...category,
      fundingAccountId: category.fundingAccountId ?? null,
    }));
}

export function AccountsManager({
  initialAccounts,
  initialCategories,
  initialPlan,
}: AccountsManagerProps) {
  // A new server payload represents a fresh saved state. Remounting the
  // stateful editor avoids copying props into state inside an effect.
  const resetKey = JSON.stringify({
    accounts: initialAccounts,
    categories: initialCategories,
    plan: initialPlan,
  });

  return (
    <AccountsManagerEditor
      key={resetKey}
      initialAccounts={initialAccounts}
      initialCategories={initialCategories}
      initialPlan={initialPlan}
    />
  );
}

function AccountsManagerEditor({
  initialAccounts,
  initialCategories,
  initialPlan,
}: AccountsManagerProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [savedCategories, setSavedCategories] = useState(() =>
    usableCategories(initialCategories),
  );
  const [draftCategories, setDraftCategories] = useState(() =>
    usableCategories(initialCategories),
  );
  const [plan, setPlan] = useState(initialPlan);
  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");
  const [mappingMessage, setMappingMessage] = useState("");
  const [mappingError, setMappingError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Account | null>(null);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Account["type"]>("CHECKING");

  function clearFeedback() {
    setAccountMessage("");
    setAccountError("");
    setMappingMessage("");
    setMappingError("");
  }

  const accountOptions = useMemo(
    () => [{ id: "", name: "Not assigned" }, ...accounts],
    [accounts],
  );

  const dirtyMappings = useMemo(() => {
    const savedById = new Map(
      savedCategories.map((category) => [
        category.id,
        category.fundingAccountId ?? "",
      ]),
    );
    return draftCategories.filter((category) => {
      const saved = savedById.get(category.id) ?? "";
      return (category.fundingAccountId ?? "") !== saved;
    });
  }, [draftCategories, savedCategories]);

  const dirtyCount = dirtyMappings.length;

  async function refreshPlan() {
    const response = await fetch("/api/funding-plan");
    const data = await response.json();
    if (response.ok) setPlan(data.plan);
  }

  async function addAccount(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (name.length < 2) {
      setAccountError("Enter an account name with at least 2 characters.");
      setAccountMessage("");
      return;
    }

    setBusy(true);
    clearFeedback();

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: newType,
          isTransferSource: accounts.length === 0,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not add account.");
      }

      setAccounts((current) =>
        [...current, data.account].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewName("");
      setAccountMessage(`Added account “${data.account.name}”.`);
      await refreshPlan();
      router.refresh();
    } catch (addError) {
      setAccountError(
        addError instanceof Error ? addError.message : "Add failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setTransferSource(accountId: string) {
    setBusy(true);
    clearFeedback();

    try {
      const response = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: accountId, isTransferSource: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not update source account.");
      }

      setAccounts((current) =>
        current.map((account) => ({
          ...account,
          isTransferSource: account.id === accountId,
        })),
      );
      setAccountMessage(`Transfers will come from “${data.account.name}”.`);
      await refreshPlan();
      router.refresh();
    } catch (updateError) {
      setAccountError(
        updateError instanceof Error ? updateError.message : "Update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function requestRemoveAccount(account: Account) {
    if (account.hasTransactions) {
      setAccountError(
        `“${account.name}” was not removed because it contains transactions. Your financial history has not been changed.`,
      );
      setAccountMessage("");
      return;
    }
    setPendingRemove(account);
    clearFeedback();
  }

  async function confirmRemoveAccount() {
    if (!pendingRemove) return;
    const account = pendingRemove;

    setBusy(true);
    clearFeedback();

    try {
      const response = await fetch(`/api/accounts?id=${account.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not remove account.");
      }

      setAccounts((current) =>
        current
          .filter((item) => item.id !== account.id)
          .map((item) => ({
            ...item,
            isTransferSource:
              data.newTransferSourceId === null
                ? item.isTransferSource
                : item.id === data.newTransferSourceId,
          })),
      );
      setSavedCategories((current) =>
        current.map((category) =>
          category.fundingAccountId === account.id
            ? { ...category, fundingAccountId: null }
            : category,
        ),
      );
      setDraftCategories((current) =>
        current.map((category) =>
          category.fundingAccountId === account.id
            ? { ...category, fundingAccountId: null }
            : category,
        ),
      );
      setPendingRemove(null);
      setAccountMessage(
        `Removed account “${account.name}”.${account.hasStatements ? " Its statement metadata was removed too." : ""}`,
      );
      await refreshPlan();
      router.refresh();
    } catch (removeError) {
      const message =
        removeError instanceof Error ? removeError.message : "Remove failed.";
      setAccountError(
        message === "Server error"
          ? `“${account.name}” was not removed because it may still have transactions. Your financial history has been kept safe.`
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  function draftMapCategory(categoryId: string, fundingAccountId: string) {
    setDraftCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              fundingAccountId: fundingAccountId || null,
            }
          : category,
      ),
    );
    setMappingMessage("");
    setMappingError("");
  }

  function discardMappingChanges() {
    setDraftCategories(savedCategories);
    setMappingMessage("Discarded unsaved mapping changes.");
    setMappingError("");
  }

  async function saveMappingChanges() {
    if (dirtyCount === 0) return;

    setBusy(true);
    setMappingMessage("");
    setMappingError("");

    try {
      const responses = await Promise.all(
        dirtyMappings.map((category) =>
          fetch("/api/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: category.id,
              fundingAccountId: category.fundingAccountId,
            }),
          }),
        ),
      );

      const bodies = await Promise.all(
        responses.map(async (response) => ({
          ok: response.ok,
          data: await response.json().catch(() => ({})),
        })),
      );

      if (bodies.some((body) => !body.ok)) {
        throw new Error(
          bodies.find((body) => !body.ok)?.data?.error ??
            "Could not save category mappings.",
        );
      }

      const nextSaved = draftCategories.map((category) => ({ ...category }));
      setSavedCategories(nextSaved);
      setDraftCategories(nextSaved);
      await refreshPlan();
      setMappingMessage(
        `Saved ${dirtyCount} mapping change${dirtyCount === 1 ? "" : "s"}. Transfer plan updated.`,
      );
      router.refresh();
    } catch (saveError) {
      setMappingError(
        saveError instanceof Error ? saveError.message : "Save failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Your bank accounts</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add the accounts you use, then mark one as the transfer source (usually
          your main checking account).
        </p>

        <form
          onSubmit={addAccount}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Account name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. DBS Checking, OCBC Credit Card"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Type
            </label>
            <select
              value={newType}
              onChange={(event) =>
                setNewType(event.target.value as Account["type"])
              }
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-emerald-500 focus:ring-2"
            >
              <option value="CHECKING">Checking</option>
              <option value="SAVINGS">Savings</option>
              <option value="CREDIT_CARD">Credit card</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Add account
          </button>
        </form>

        <ul className="mt-5 space-y-3">
          {accounts.map((account) => (
            <li
              key={account.id}
              className={`rounded-xl border px-4 py-3 ${
                pendingRemove?.id === account.id
                  ? "border-amber-200 bg-amber-50/60"
                  : "border-slate-100"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {account.name}
                    {account.isTransferSource ? (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Transfer source
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-slate-500">
                    {TYPE_LABELS[account.type]}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!account.isTransferSource ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setTransferSource(account.id)}
                      className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                    >
                      Use as source
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => requestRemoveAccount(account)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {pendingRemove?.id === account.id ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-sm font-medium text-amber-950">
                    Remove account “{account.name}”?
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    Categories mapped to this account will become unassigned.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={confirmRemoveAccount}
                      disabled={busy}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      {busy ? "Removing..." : "Yes, remove"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRemove(null)}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {accountMessage ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {accountMessage}
          </p>
        ) : null}
        {accountError ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {accountError}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Category → account mapping
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose which bank account should cover each expense category, then
              save to update the transfer plan and balances.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || dirtyCount === 0}
              onClick={discardMappingChanges}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={busy || dirtyCount === 0}
              onClick={saveMappingChanges}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy
                ? "Saving..."
                : dirtyCount > 0
                  ? `Save ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}`
                  : "Save mappings"}
            </button>
          </div>
        </div>

        {dirtyCount > 0 ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You have unsaved mapping changes. The transfer plan below still shows
            the last saved setup until you click Save.
          </p>
        ) : null}

        {mappingMessage ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mappingMessage}
          </p>
        ) : null}
        {mappingError ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {mappingError}
          </p>
        ) : null}

        <div className="mt-5 space-y-3">
          {draftCategories.map((category) => {
            const saved = savedCategories.find(
              (item) => item.id === category.id,
            );
            const isDirty =
              (category.fundingAccountId ?? "") !==
              (saved?.fundingAccountId ?? "");

            return (
              <div
                key={category.id}
                className={`grid gap-3 rounded-xl border px-4 py-3 sm:grid-cols-[1fr_220px] sm:items-center ${
                  isDirty
                    ? "border-amber-200 bg-amber-50/40"
                    : "border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-base"
                    style={{
                      backgroundColor: `${category.color ?? "#10b981"}22`,
                    }}
                  >
                    {category.icon ?? "📁"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {category.name}
                    </p>
                    {isDirty ? (
                      <p className="text-xs font-medium text-amber-800">
                        Unsaved change
                      </p>
                    ) : null}
                  </div>
                </div>
                <select
                  value={category.fundingAccountId ?? ""}
                  disabled={busy}
                  onChange={(event) =>
                    draftMapCategory(category.id, event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60"
                >
                  {accountOptions.map((account) => (
                    <option key={account.id || "none"} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Transfer plan this month
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Based on saved category mappings
          {plan.sourceAccount
            ? ` from ${plan.sourceAccount.name}`
            : ""}
          .
        </p>

        {plan.transfers.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Map categories to accounts, save your changes, and upload spending to
            see transfer amounts.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {plan.transfers.map((transfer) => (
              <li
                key={`${transfer.fromAccountId}-${transfer.toAccountId}`}
                className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3"
              >
                <p className="font-semibold text-slate-900">
                  {formatCurrency(transfer.amount)}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {transfer.fromAccountName} → {transfer.toAccountName}
                </p>
                {transfer.categoryNames.length > 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Covers: {transfer.categoryNames.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {plan.accounts
            .filter((account) => account.categories.length > 0)
            .map((account) => (
              <div
                key={account.accountId}
                className="rounded-xl border border-slate-100 px-4 py-3"
              >
                <p className="font-medium text-slate-900">{account.accountName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Spent {formatCurrency(account.spentAmount)} · Budget{" "}
                  {formatCurrency(account.budgetAmount)}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {account.categories.map((category) => (
                    <li key={category.categoryId}>
                      {category.icon ?? "📁"} {category.categoryName}:{" "}
                      {formatCurrency(category.spent)}
                      {category.budget > 0
                        ? ` / ${formatCurrency(category.budget)}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>

        {plan.unassigned.categories.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
            <p className="text-sm font-medium text-amber-950">
              Unassigned categories · spent{" "}
              {formatCurrency(plan.unassigned.spentAmount)}
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {plan.unassigned.categories
                .map((category) => category.categoryName)
                .join(", ")}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
