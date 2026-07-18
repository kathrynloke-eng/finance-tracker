"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

type Item = { _id: string; name: string; icon?: string | null; hasFundingAccount?: boolean };
type Schedule = { _id: string; categoryId: string; amount: number; dayOfMonth: number; isActive: boolean };

export function ReserveScheduleManager({ categories, schedules, budgetTargets }: { categories: Item[]; schedules: Schedule[]; budgetTargets: Record<string, number> }) {
  const router = useRouter();
  const save = useMutation(api.finance.saveReserveSchedule);
  const removeSchedule = useMutation(api.finance.deleteReserveSchedule);
  const [categoryId, setCategoryId] = useState(categories[0]?._id ?? "");
  const current = schedules.find((schedule) => schedule.categoryId === categoryId);
  const [amount, setAmount] = useState("");
  const suggestedAmount = budgetTargets[categoryId] ?? current?.amount ?? 0;
  const amountValue = amount === "" && suggestedAmount > 0 ? String(suggestedAmount) : amount;
  const [day, setDay] = useState("1");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await save({ categoryId: categoryId as never, amount: Number(amountValue), dayOfMonth: Number(day), isActive: true });
      setMessage("Schedule saved. It will appear for review on its due day.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the schedule."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!current) return;
    setBusy(true); setMessage("");
    try {
      await removeSchedule({ categoryId: categoryId as never });
      setMessage("Reserve schedule removed.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove the schedule."); }
    finally { setBusy(false); }
  }

  if (!categories.length) return <p className="text-sm text-slate-500">Create a reserve category before scheduling an allocation.</p>;
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border border-lime-200 bg-lime-50/60 p-4 sm:grid-cols-4">
    <p className="sm:col-span-4 text-sm text-slate-700">The amount starts from this category’s monthly budget target. Funds use the account mapped to this category under Accounts. On the due date, you can adjust and confirm it directly from the Dashboard.</p>
    <select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setAmount(""); setMessage(""); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{categories.map((item) => <option key={item._id} value={item._id}>{item.icon ?? "📁"} {item.name}</option>)}</select>
    <input value={amountValue} onChange={(event) => setAmount(event.target.value)} required inputMode="decimal" placeholder="Amount" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
    <select value={day} onChange={(event) => setDay(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{Array.from({ length: 28 }, (_, index) => <option key={index + 1} value={index + 1}>Day {index + 1}</option>)}</select>
    <div className="sm:col-span-4 flex flex-wrap gap-2"><button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving..." : current ? "Update schedule" : "Set monthly review"}</button>{current ? <button type="button" onClick={() => void remove()} disabled={busy} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60">Remove schedule</button> : null}</div>
    {message ? <p className="sm:col-span-4 text-sm text-slate-600">{message}</p> : null}
  </form>;
}
