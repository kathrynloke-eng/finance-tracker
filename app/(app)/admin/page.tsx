"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { AdminPasswordReset } from "@/components/admin-password-reset";
import { SectionCard } from "@/components/ui";
import { api } from "@/convex/_generated/api";

export default function AdminPage() {
  const isAdministrator = useQuery(api.users.isAdministrator);

  if (isAdministrator === undefined) {
    return <p className="text-sm text-slate-500">Checking administrator access…</p>;
  }

  if (!isAdministrator) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <h2 className="text-xl font-semibold text-rose-950">Administrator access required</h2>
        <p className="mt-2 text-sm leading-6 text-rose-800">This page is available only to the configured administrator account.</p>
        <Link href="/" className="mt-5 inline-block text-sm font-semibold text-rose-950 underline">Return to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-4">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Administrator tools</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Reset a user password</h2>
        <p className="mt-2 max-w-xl text-slate-600">Create a new temporary password when a user cannot sign in. You never see or store their previous password.</p>
      </div>
      <SectionCard title="Temporary password" description="This immediately ends the user’s existing signed-in sessions.">
        <AdminPasswordReset />
      </SectionCard>
    </div>
  );
}
