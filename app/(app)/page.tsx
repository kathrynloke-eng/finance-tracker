import Link from "next/link";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { getMonthlySummary, getCurrentMonthKey } from "@/lib/budget";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { StatCard, SectionCard } from "@/components/ui";
import { BudgetBar } from "@/components/budget-bar";

export default async function DashboardPage() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const month = getCurrentMonthKey();
  const summary = await getMonthlySummary(user.id, month);

  const [alerts, transfers, pendingCount] = await Promise.all([
    prisma.alert.findMany({
      where: { userId: user.id, month },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.transferSuggestion.findMany({
      where: { userId: user.id, month, status: "SUGGESTED" },
      include: { fromAccount: true, toAccount: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.count({
      where: { userId: user.id, status: "PENDING_REVIEW" },
    }),
  ]);

  const totalTone =
    summary.totalBudget > 0 && summary.totalSpent > summary.totalBudget
      ? "danger"
      : summary.totalVariance < 0
        ? "success"
        : "default";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">
            {formatMonthLabel(month)} overview
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Know where your money goes
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Upload statements, track category spending against your monthly targets,
            and review transfer suggestions between accounts.
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Upload statement
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total spent"
          value={formatCurrency(summary.totalSpent)}
          hint={`${summary.categories.filter((item) => item.spent > 0).length} active categories`}
        />
        <StatCard
          label="Monthly budget"
          value={formatCurrency(summary.totalBudget)}
          hint="Sum of category targets"
        />
        <StatCard
          label="Budget variance"
          value={formatCurrency(Math.abs(summary.totalVariance))}
          hint={
            summary.totalVariance > 0
              ? "Over total budget"
              : summary.totalVariance < 0
                ? "Under total budget"
                : "Exactly on budget"
          }
          tone={totalTone}
        />
        <StatCard
          label="Needs review"
          value={String(pendingCount)}
          hint="Transactions awaiting category confirmation"
          tone={pendingCount > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title="Spending by category"
          description="Compare actual spend against your monthly targets."
        >
          <div className="space-y-3">
            {summary.categories
              .filter((category) => category.target > 0 || category.spent > 0)
              .map((category) => (
                <BudgetBar
                  key={category.categoryId}
                  name={category.categoryName}
                  icon={category.icon}
                  color={category.color}
                  spent={category.spent}
                  target={category.target}
                  status={category.status}
                />
              ))}
            {summary.categories.every(
              (category) => category.target === 0 && category.spent === 0,
            ) ? (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Set category targets in Budgets, then upload a statement to see progress.
              </p>
            ) : null}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Alerts"
            description="Overspending and savings notifications for this month."
          >
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">No alerts yet for this month.</p>
            ) : (
              <ul className="space-y-3">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className={`rounded-xl px-4 py-3 text-sm ${
                      alert.type === "OVERSPEND"
                        ? "bg-rose-50 text-rose-800"
                        : alert.type === "SURPLUS"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-blue-50 text-blue-800"
                    }`}
                  >
                    {alert.message}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Transfer suggestions"
            description="Recommended moves between your accounts."
          >
            {transfers.length === 0 ? (
              <p className="text-sm text-slate-500">
                Upload spending data to generate transfer suggestions.
              </p>
            ) : (
              <ul className="space-y-3">
                {transfers.map((transfer) => (
                  <li
                    key={transfer.id}
                    className="rounded-xl border border-slate-100 px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-slate-900">
                      {formatCurrency(transfer.amount)}: {transfer.fromAccount.name} →{" "}
                      {transfer.toAccount.name}
                    </p>
                    <p className="mt-1 text-slate-500">{transfer.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
