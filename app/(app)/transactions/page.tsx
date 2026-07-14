"use client";

import { TransactionManager } from "@/components/transaction-manager";
import { SectionCard } from "@/components/ui";
import { useFinanceOverview } from "@/components/use-finance-overview";

export default function TransactionsPage() {
  const data = useFinanceOverview();
  if (!data) return <p className="text-sm text-slate-500">Loading your transactions…</p>;
  return <div className="space-y-8"><div><h2 className="text-3xl font-semibold tracking-tight text-slate-900">Transactions</h2><p className="mt-2 max-w-2xl text-slate-600">Add, edit, or delete transactions. Your data remains private to your account.</p></div><SectionCard title="Manage activity" description="Search, create manual entries, update details, or remove transactions."><TransactionManager transactions={data.transactions.map((transaction) => ({ ...transaction, id: String(transaction._id), date: new Date(transaction.date).toISOString(), accountId: String(transaction.accountId), recurringTransactionId: null, category: transaction.category ? { id: String(transaction.category._id), name: transaction.category.name } : null, account: transaction.account ? { id: String(transaction.account._id), name: transaction.account.name, type: transaction.account.type } : null }))} categories={data.categories.map((category) => ({ id: String(category._id), name: category.name }))} accounts={data.accounts.map((account) => ({ id: String(account._id), name: account.name, type: account.type }))} /></SectionCard></div>;
}
