"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/upload", label: "Upload", icon: "📄" },
  { href: "/transactions", label: "Transactions", icon: "💳" },
  { href: "/budgets", label: "Budgets", icon: "🎯" },
  { href: "/accounts", label: "Accounts", icon: "🏦" },
];

export function AppNav() {
  const { signOut } = useAuthActions();
  return (
    <header className="border-b border-emerald-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
            Monthly Finance
          </p>
          <h1 className="text-xl font-semibold text-slate-900">Finance Tracker</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-transparent px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <span className="mr-1.5">{link.icon}</span>
              {link.label}
            </Link>
          ))}
          <button type="button" onClick={() => void signOut()} className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-800">Sign out</button>
        </nav>
      </div>
    </header>
  );
}
