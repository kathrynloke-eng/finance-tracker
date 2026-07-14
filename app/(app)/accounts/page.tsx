"use client";

import { AccountsManager } from "@/components/accounts-manager";
import { currentMonth, useFinanceOverview } from "@/components/use-finance-overview";
import { formatMonthLabel } from "@/lib/format";

export default function AccountsPage() {
  const month = currentMonth(); const data = useFinanceOverview(month);
  if (!data) return <p className="text-sm text-slate-500">Loading your accounts…</p>;
  const source = data.accounts.find((account) => account.isTransferSource) ?? null;
  const plan = { month, sourceAccount: source ? { id: String(source._id), name: source.name, type: source.type } : null, unassigned: { spentAmount: 0, budgetAmount: 0, categories: [] }, accounts: [], transfers: [] };
  return <div className="space-y-8"><div><p className="text-sm font-medium text-emerald-700">{formatMonthLabel(month)}</p><h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Accounts & transfers</h2><p className="mt-2 max-w-2xl text-slate-600">Set up accounts and map categories to the account that should cover them.</p></div><AccountsManager initialAccounts={data.accounts.map((account) => ({ ...account, id: String(account._id) }))} initialCategories={data.categories.map((category) => ({ ...category, id: String(category._id), fundingAccountId: category.fundingAccountId ? String(category.fundingAccountId) : null, icon: category.icon ?? null, color: category.color ?? null }))} initialPlan={plan} /></div>;
}
