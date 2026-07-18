"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

const links = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/transactions", label: "Transactions", icon: "💳" },
  { href: "/budgets", label: "Budgets", icon: "🎯" },
  { href: "/allocation", label: "Plan", icon: "💰" },
  { href: "/accounts", label: "Accounts", icon: "🏦" },
  { href: "/security", label: "Security", icon: "🔒" },
  { href: "/guide", label: "Guide", icon: "✨" },
];

const mobilePrimaryLinks = links.slice(0, 3);
const mobileMoreLinks = links.slice(3);

export function AppNav() {
  const { signOut } = useAuthActions();
  const isAdministrator = useQuery(api.users.isAdministrator);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const moreLinks = isAdministrator
    ? [...mobileMoreLinks, { href: "/admin", label: "Admin", icon: "🛡️" }]
    : mobileMoreLinks;

  return (
    <>
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-6 lg:py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Monthly Finance
          </p>
          <h1 className="text-xl font-semibold text-slate-900">Finance Tracker</h1>
        </div>
        <nav className="hidden flex-wrap items-center gap-2 lg:flex">
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
        <button type="button" onClick={() => void signOut()} className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-lime-100 hover:text-slate-900 lg:hidden">Sign out</button>
      </div>

      </header>

      {mobileMoreOpen ? (
        <>
          <button
            type="button"
            aria-label="Close more navigation"
            className="fixed inset-0 z-40 bg-slate-950/10 lg:hidden"
            onClick={() => setMobileMoreOpen(false)}
          />
          <div className="fixed inset-x-4 bottom-20 z-50 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl lg:hidden">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">More</p>
            <div className="grid grid-cols-2 gap-2">
              {moreLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileMoreOpen(false)} className="rounded-xl bg-stone-50 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-lime-100 hover:text-slate-950">
                  <span className="mr-2">{link.icon}</span>{link.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-[60] grid grid-cols-4 border-t border-stone-200 bg-white/95 px-2 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden" aria-label="Mobile navigation">
        {mobilePrimaryLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setMobileMoreOpen(false)} className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-lime-100 hover:text-slate-950">
            <span className="text-base">{link.icon}</span>
            {link.label}
          </Link>
        ))}
        <button type="button" onClick={() => setMobileMoreOpen((current) => !current)} aria-expanded={mobileMoreOpen} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium transition ${mobileMoreOpen ? "bg-lime-100 text-slate-950" : "text-slate-600 hover:bg-lime-100 hover:text-slate-950"}`}>
          <span className="text-base">•••</span>
          More
        </button>
      </nav>
    </>
  );
}
