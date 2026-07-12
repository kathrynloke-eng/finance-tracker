import Link from "next/link";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { getMonthlySummary, getCurrentMonthKey } from "@/lib/budget";
import { getFundingPlan } from "@/lib/funding";
import { materializeDueRecurringTransactions } from "@/lib/recurring";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { StatCard, SectionCard } from "@/components/ui";
import { BudgetBar } from "@/components/budget-bar";

export default async function DashboardPage() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const month = getCurrentMonthKey();
  await materializeDueRecurringTransactions(user.id);
  const summary = await getMonthlySummary(user.id, month);

  const [alerts, transfers, fundingPlan] = await Promise.all([
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
    getFundingPlan(user.id, month),
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
            Track spending, reserves, and transfer suggestions for the month.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/budgets"
            className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            Edit budgets
          </Link>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Upload statement
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Monthly spent"
          value={formatCurrency(summary.totalSpent)}
          hint={`${summary.categories.filter((item) => item.budgetStyle === "MONTHLY" && item.spent > 0).length} spend categories · reserves excluded`}
        />
        <StatCard
          label="Monthly budget"
          value={formatCurrency(summary.totalBudget)}
          hint="Spend targets only (reserves excluded)"
        />
        <StatCard
          label="Budget variance"
          value={formatCurrency(Math.abs(summary.totalVariance))}
          hint={
            summary.totalVariance > 0
              ? "Over monthly spend budget"
              : summary.totalVariance < 0
                ? "Under monthly spend budget"
                : "Exactly on budget"
          }
          tone={totalTone}
        />
        <StatCard
          label="Reserve available"
          value={formatCurrency(summary.totalReserveAvailable)}
          hint={
            summary.totalReserveAllocated > 0
              ? `${formatCurrency(summary.totalReserveDrawn)} drawn total · ${formatCurrency(summary.totalReserveAllocated)} set aside · ${formatCurrency(summary.totalReserveDrawnThisMonth)} this month`
              : "No reserve categories yet"
          }
          tone={
            summary.totalReserveAvailable > 0
              ? "success"
              : summary.totalReserveAllocated > 0
                ? "warning"
                : "default"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title="Spending by category"
          description="Monthly spend targets vs reserves you allocate and draw when needed."
        >
          <div className="space-y-3">
            {summary.categories
              .filter(
                (category) =>
                  category.target > 0 ||
                  category.spent > 0 ||
                  category.allocatedTotal > 0,
              )
              .map((category) => (
                <BudgetBar
                  key={category.categoryId}
                  name={category.categoryName}
                  icon={category.icon}
                  color={category.color}
                  spent={category.spent}
                  target={category.target}
                  status={category.status}
                  budgetStyle={category.budgetStyle}
                  available={category.available}
                  allocatedTotal={category.allocatedTotal}
                  spentTotal={category.spentTotal}
                  reserveState={category.reserveState}
                />
              ))}
            {summary.categories.every(
              (category) =>
                category.target === 0 &&
                category.spent === 0 &&
                category.allocatedTotal === 0,
            ) ? (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Set targets on the Budgets page, then upload a statement to see
                progress.
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
            title="Transfer plan"
            description="How much to move based on category → account mapping."
            action={
              <Link
                href="/accounts"
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                Manage accounts
              </Link>
            }
          >
            {fundingPlan.transfers.length === 0 && transfers.length === 0 ? (
              <p className="text-sm text-slate-500">
                Map categories to bank accounts on the Accounts page to see transfer
                amounts.
              </p>
            ) : (
              <ul className="space-y-3">
                {(fundingPlan.transfers.length > 0
                  ? fundingPlan.transfers.map((transfer) => ({
                      id: `${transfer.toAccountId}`,
                      amount: transfer.amount,
                      from: transfer.fromAccountName,
                      to: transfer.toAccountName,
                      reason:
                        transfer.categoryNames.length > 0
                          ? `Covers ${transfer.categoryNames.join(", ")}`
                          : "Mapped category spending",
                    }))
                  : transfers.map((transfer) => ({
                      id: transfer.id,
                      amount: transfer.amount,
                      from: transfer.fromAccount.name,
                      to: transfer.toAccount.name,
                      reason: transfer.reason,
                    }))
                ).map((transfer) => (
                  <li
                    key={transfer.id}
                    className="rounded-xl border border-slate-100 px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-slate-900">
                      {formatCurrency(transfer.amount)}: {transfer.from} →{" "}
                      {transfer.to}
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
