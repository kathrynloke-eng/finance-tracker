"use client";

import { useRouter } from "next/navigation";
import { TransactionManager } from "@/components/transaction-manager";
import { UploadForm } from "@/components/upload-form";
import { SectionCard } from "@/components/ui";
import { useFinanceOverview } from "@/components/use-finance-overview";

export default function TransactionsPage() {
  const router = useRouter();
  const data = useFinanceOverview();
  if (!data) return <p className="text-sm text-slate-500">Loading your transactions…</p>;

  const accounts = data.accounts.map((account) => ({
    id: String(account._id),
    name: account.name,
    type: account.type,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Transactions</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Choose the easiest way to add activity, then review and categorise everything in one private place.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Add manually" description="Enter a single expense, income, or transfer yourself.">
          <p className="text-sm leading-6 text-slate-600">Use the Add transaction button below when you want to record something quickly.</p>
          <a href="#manual-entry" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
            Add a transaction
          </a>
        </SectionCard>
        <SectionCard title="Import a statement" description="Choose an account and upload a text-based monthly PDF.">
          <UploadForm accounts={accounts} onImported={() => router.refresh()} />
        </SectionCard>
      </div>

      <div id="manual-entry">
        <SectionCard title="Manage activity" description="Search, create manual entries, update details, or remove transactions.">
          <TransactionManager
            transactions={data.transactions.map((transaction) => ({
              ...transaction,
              id: String(transaction._id),
              date: new Date(transaction.date).toISOString(),
              accountId: String(transaction.accountId),
              recurringTransactionId: null,
              category: transaction.category ? { id: String(transaction.category._id), name: transaction.category.name } : null,
              account: transaction.account ? { id: String(transaction.account._id), name: transaction.account.name, type: transaction.account.type } : null,
            }))}
            categories={data.categories.map((category) => ({ id: String(category._id), name: category.name }))}
            accounts={accounts}
          />
        </SectionCard>
      </div>

      <SectionCard title="Recent imports" description="Processing metadata only — never the PDF, raw text, or original filename.">
        {data.statements.length === 0 ? (
          <p className="text-sm text-slate-500">No statements imported yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.statements.map((statement) => (
              <li key={String(statement._id)} className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm">
                <p className="font-medium text-slate-900">{statement.fileName}</p>
                <p className="mt-1 text-slate-500">{statement.status.toLowerCase()}</p>
                {statement.errorMessage ? <p className="mt-2 text-rose-600">{statement.errorMessage}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
