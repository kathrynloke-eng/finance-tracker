"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

export function ReserveReviewPrompt({ schedules }: { schedules: Array<{ _id: string; amount: number; category: { name: string; icon?: string | null } | null; account: { name: string } | null }> }) {
  const confirmReserveReview = useMutation(api.finance.confirmReserveReview);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(schedules.map((schedule) => [schedule._id, String(schedule.amount)])));
  if (!schedules.length) return null;
  async function confirm(scheduleId: string) { setBusy(scheduleId); setMessage(""); try { await confirmReserveReview({ scheduleId: scheduleId as never, amount: Number(amounts[scheduleId]) }); setMessage("Reserve transaction confirmed and added to your tracking."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not confirm the reserve transaction."); } finally { setBusy(null); } }
  return <section className="rounded-2xl border border-lime-200 bg-lime-50 p-5 shadow-sm sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-800">Reserve review due</p><h3 className="mt-1 text-lg font-semibold text-slate-900">Review and confirm</h3><p className="mt-1 text-sm text-slate-600">Adjust the amount if needed, then confirm it here to add the final transaction.</p><div className="mt-4 space-y-3">{schedules.map((schedule) => <div key={schedule._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><p className="text-sm font-medium text-slate-800">{schedule.category?.icon ?? "📁"} {schedule.category?.name ?? "Reserve"}{schedule.account ? ` · ${schedule.account.name}` : ""}</p><div className="flex items-center gap-2"><input aria-label={`Reserve amount for ${schedule.category?.name ?? "reserve"}`} value={amounts[schedule._id] ?? ""} onChange={(event) => setAmounts((current) => ({ ...current, [schedule._id]: event.target.value }))} inputMode="decimal" className="w-24 rounded-lg border border-lime-300 bg-white px-2 py-2 text-right text-sm font-semibold" /><button onClick={() => void confirm(schedule._id)} disabled={busy !== null} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy === schedule._id ? "Saving..." : "Confirm & add"}</button></div></div>)}</div>{message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}</section>;
}
