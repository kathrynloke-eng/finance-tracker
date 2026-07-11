import { format, startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";

export function getCurrentMonthKey(date = new Date()) {
  return format(date, "yyyy-MM");
}

export async function getMonthlySummary(userId: string, month: string) {
  const monthDate = new Date(`${month}-01`);
  const rangeStart = startOfMonth(monthDate);
  const rangeEnd = endOfMonth(monthDate);

  const [categories, budgets, transactions] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    }),
    prisma.monthlyBudget.findMany({
      where: { userId, month },
      include: { category: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: rangeStart, lte: rangeEnd },
        amount: { lt: 0 },
      },
      include: { category: true },
    }),
  ]);

  const spentByCategory = new Map<string, number>();
  for (const transaction of transactions) {
    const categoryId = transaction.categoryId ?? "uncategorized";
    const current = spentByCategory.get(categoryId) ?? 0;
    spentByCategory.set(categoryId, current + Math.abs(transaction.amount));
  }

  const budgetByCategory = new Map(
    budgets.map((budget) => [budget.categoryId, budget.targetAmount]),
  );

  const categorySummaries = categories
    .filter((category) => category.name !== "Income" && category.name !== "Transfer")
    .map((category) => {
      const spent = spentByCategory.get(category.id) ?? 0;
      const target = budgetByCategory.get(category.id) ?? 0;
      const variance = spent - target;
      const percentUsed = target > 0 ? (spent / target) * 100 : 0;

      return {
        categoryId: category.id,
        categoryName: category.name,
        icon: category.icon,
        color: category.color,
        spent,
        target,
        variance,
        percentUsed,
        status:
          target === 0
            ? "no_budget"
            : spent > target
              ? "overspent"
              : percentUsed >= 80
                ? "warning"
                : "on_track",
      };
    });

  const totalSpent = categorySummaries.reduce((sum, item) => sum + item.spent, 0);
  const totalBudget = categorySummaries.reduce((sum, item) => sum + item.target, 0);
  const totalVariance = totalSpent - totalBudget;

  return {
    month,
    totalSpent,
    totalBudget,
    totalVariance,
    categories: categorySummaries,
  };
}

export async function syncBudgetAlerts(userId: string, month: string) {
  const summary = await getMonthlySummary(userId, month);

  await prisma.alert.deleteMany({
    where: {
      userId,
      month,
      type: { in: ["OVERSPEND", "SURPLUS"] },
    },
  });

  type AlertInput = {
    userId: string;
    month: string;
    type: "OVERSPEND" | "SURPLUS";
    categoryId: string;
    message: string;
  };

  const alerts: AlertInput[] = [];

  for (const category of summary.categories) {
    if (category.target <= 0) continue;

    if (category.spent > category.target) {
      alerts.push({
        userId,
        month,
        type: "OVERSPEND",
        categoryId: category.categoryId,
        message: `Overspent on ${category.categoryName} by $${(category.spent - category.target).toFixed(2)} (${category.percentUsed.toFixed(0)}% of budget).`,
      });
      continue;
    }

    if (category.spent < category.target * 0.5 && category.spent > 0) {
      alerts.push({
        userId,
        month,
        type: "SURPLUS",
        categoryId: category.categoryId,
        message: `Under budget on ${category.categoryName} — saved $${(category.target - category.spent).toFixed(2)} so far.`,
      });
    }
  }

  if (alerts.length > 0) {
    await prisma.alert.createMany({ data: alerts });
  }

  return alerts.length;
}
