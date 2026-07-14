"use client";

import { UploadForm } from "@/components/upload-form";
import { SectionCard } from "@/components/ui";
import { useFinanceOverview } from "@/components/use-finance-overview";

export default function UploadPage() {
  const data = useFinanceOverview();
  if (!data) return <p className="text-sm text-slate-500">Loading your accounts…</p>;
  return <div className="space-y-8"><div><h2 className="text-3xl font-semibold tracking-tight text-slate-900">Upload PDF statement</h2><p className="mt-2 max-w-2xl text-slate-600">The PDF is parsed in memory and discarded immediately. Only the transaction records you choose to import are retained.</p></div><div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><SectionCard title="Import a statement" description="Choose an account and upload a text-based monthly PDF."><UploadForm accounts={data.accounts.map((account) => ({ id: String(account._id), name: account.name, type: account.type }))} /></SectionCard><SectionCard title="Recent uploads" description="Processing metadata only — never the PDF, raw text, or original filename.">{data.statements.length === 0 ? <p className="text-sm text-slate-500">No statements uploaded yet.</p> : <ul className="space-y-3">{data.statements.map((statement) => <li key={String(statement._id)} className="rounded-xl border border-slate-100 px-4 py-3 text-sm"><p className="font-medium text-slate-900">{statement.fileName}</p><p className="mt-1 text-slate-500">{statement.status.toLowerCase()}</p>{statement.errorMessage ? <p className="mt-2 text-rose-600">{statement.errorMessage}</p> : null}</li>)}</ul>}</SectionCard></div></div>;
}
