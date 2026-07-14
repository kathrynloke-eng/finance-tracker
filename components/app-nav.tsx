"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

const links = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/transactions", label: "Transactions", icon: "💳" },
  { href: "/budgets", label: "Budgets", icon: "🎯" },
  { href: "/allocation", label: "Plan", icon: "💰" },
  { href: "/accounts", label: "Accounts", icon: "🏦" },
  { href: "/guide", label: "Guide", icon: "✨" },
];

export function AppNav() {
  const { signOut } = useAuthActions();
  const isAdministrator = useQuery(api.users.isAdministrator);
  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Monthly Finance
          </p>
          <h1 className="text-xl font-semibold text-slate-900">Finance Tracker</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-transparent px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-lime-300 hover:bg-lime-100 hover:text-slate-900"
            >
              <span className="mr-1.5">{link.icon}</span>
              {link.label}
            </Link>
          ))}
          {isAdministrator ? (
            <Link
              href="/admin"
              className="rounded-full border border-transparent px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-lime-300 hover:bg-lime-100 hover:text-slate-900"
            >
              <span className="mr-1.5">🛡️</span>
              Admin
            </Link>
          ) : null}
          <button type="button" onClick={() => void signOut()} className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-lime-100 hover:text-slate-900">Sign out</button>
        </nav>
      </div>
    </header>
  );
}
