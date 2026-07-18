"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { formatCurrency } from "@/lib/format";

export function ReserveReviewPrompt({ schedules }: { schedules: Array<{ _id: string; amount: number; category: { name: string; icon?: string | null } | null; account: { name: string } | null }> }) {
  const addForReview = useMutation(api.finance.addReserveForReview);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  if (!schedules.length) return null;
  async function add(scheduleId: string) { setBusy(scheduleId); setMessage(""); try { await addForReview({ scheduleId: scheduleId as never }); setMessage("Added for review. Confirm or edit it on Transactions before it affects your reserve totals."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add the reserve for review."); } finally { setBusy(null); } }
  return <section className="rounded-2xl border border-lime-200 bg-lime-50 p-5 shadow-sm sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-800">Reserve review due</p><h3 className="mt-1 text-lg font-semibold text-slate-900">Review before tracking</h3><p className="mt-1 text-sm text-slate-600">Nothing is recorded until you choose an item, then confirm it in Transactions.</p><div className="mt-4 space-y-3">{schedules.map((schedule) => <div key={schedule._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><p className="text-sm font-medium text-slate-800">{schedule.category?.icon ?? "📁"} {schedule.category?.name ?? "Reserve"} · {formatCurrency(schedule.amount)}{schedule.account ? ` from ${schedule.account.name}` : ""}</p><button onClick={() => void add(schedule._id)} disabled={busy !== null} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy === schedule._id ? "Adding..." : "Add for review"}</button></div>)}</div>{message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}</section>;
}
