"use client";

import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

export function AdminPasswordReset() {
  const resetPassword = useAction(api.users.adminResetPassword);
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setTemporaryPassword(null);
    try {
      const result = await resetPassword({ email: email.trim() });
      setTemporaryPassword(result.temporaryPassword);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password reset failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          User email address
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="friend@example.com"
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2"
          />
        </label>
        <button
          disabled={pending}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating temporary password…" : "Reset password"}
        </button>
      </form>

      {temporaryPassword ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Temporary password — copy it now</p>
          <code className="mt-3 block select-all rounded-lg bg-white px-3 py-2.5 font-mono text-base font-semibold text-slate-900">{temporaryPassword}</code>
          <p className="mt-3 text-sm leading-6 text-amber-900">Share this only through a trusted private channel. It is not saved in the app, and the user’s other signed-in sessions have been ended.</p>
        </div>
      ) : null}

      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
