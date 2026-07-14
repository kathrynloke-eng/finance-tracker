"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

export function AuthForm({ mode }: { mode: "signIn" | "signUp" }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const signingUp = mode === "signUp";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      await signIn("password", { email, password, flow: mode });
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed.");
    } finally { setPending(false); }
  }

  return <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
    <form onSubmit={submit} className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">Monthly Finance</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{signingUp ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-sm text-slate-600">Your finance data is private to your account.</p>
      <label className="mt-6 block text-sm font-medium text-slate-700">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2" /></label>
      <label className="mt-4 block text-sm font-medium text-slate-700">Password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2" /></label>
      {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <button disabled={pending} className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Please wait…" : signingUp ? "Create account" : "Sign in"}</button>
      <p className="mt-4 text-center text-sm text-slate-600">{signingUp ? "Already have an account?" : "New here?"} <Link href={signingUp ? "/sign-in" : "/sign-up"} className="font-semibold text-emerald-700">{signingUp ? "Sign in" : "Create one"}</Link></p>
    </form>
  </main>;
}
