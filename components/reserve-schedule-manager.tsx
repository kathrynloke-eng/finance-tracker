"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

type Item = { _id: string; name: string; icon?: string | null };
type Schedule = { _id: string; categoryId: string; accountId: string; amount: number; dayOfMonth: number; isActive: boolean };

export function ReserveScheduleManager({ categories, accounts, schedules }: { categories: Item[]; accounts: Item[]; schedules: Schedule[] }) {
  const save = useMutation(api.finance.saveReserveSchedule);
  const [categoryId, setCategoryId] = useState(categories[0]?._id ?? "");
  const current = schedules.find((schedule) => schedule.categoryId === categoryId);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?._id ?? "");
  const [day, setDay] = useState("1");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await save({ categoryId: categoryId as never, accountId: accountId as never, amount: Number(amount), dayOfMonth: Number(day), isActive: true });
      setMessage("Schedule saved. It will appear for review on its due day.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the schedule."); }
    finally { setBusy(false); }
  }

  if (!categories.length || !accounts.length) return <p className="text-sm text-slate-500">Create a reserve category and an account before scheduling an allocation.</p>;
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border border-lime-200 bg-lime-50/60 p-4 sm:grid-cols-4">
    <p className="sm:col-span-4 text-sm text-slate-700">On the due date, the app asks you to review the transaction. Nothing is counted until you confirm it in Transactions.</p>
    <select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setMessage(""); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{categories.map((item) => <option key={item._id} value={item._id}>{item.icon ?? "📁"} {item.name}</option>)}</select>
    <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{accounts.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>
    <input value={amount} onChange={(event) => setAmount(event.target.value)} required inputMode="decimal" placeholder={current ? String(current.amount) : "Amount"} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
    <select value={day} onChange={(event) => setDay(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{Array.from({ length: 28 }, (_, index) => <option key={index + 1} value={index + 1}>Day {index + 1}</option>)}</select>
    <button disabled={busy} className="sm:col-span-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving..." : current ? "Update schedule" : "Set monthly review"}</button>
    {message ? <p className="sm:col-span-4 text-sm text-slate-600">{message}</p> : null}
  </form>;
}
