import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { monthKeyToLocalRange } from "@/lib/dates";

export function getCurrentMonthKey(date = new Date()) {
  return format(date, "yyyy-MM");
}

export type CategoryBudgetStyle = "MONTHLY" | "RESERVE";

export type CategorySummary = {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  color: string | null;
  budgetStyle: CategoryBudgetStyle;
  spent: number;
  target: number;
  allocatedTotal: number;
  spentTotal: number;
  available: number;
  variance: number;
  percentUsed: number;
  status: "no_budget" | "overspent" | "warning" | "on_track";
  reserveState?: "healthy" | "low" | "fully_drawn" | "overdrawn";
};

function netOutflow(sumAmount: number | null | undefined) {
  // Expenses are negative; net outflow is how much left the pot.
  return Math.max(0, -(sumAmount ?? 0));
}

export async function getMonthlySummary(userId: string, month: string) {
  const { start: rangeStart, end: rangeEnd } = monthKeyToLocalRange(month);

  const [categories, budgets, monthTransactions, allBudgets, lifetimeFlows] =
    await Promise.all([
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
          status: "CONFIRMED",
        },
        include: { category: true },
      }),
      prisma.monthlyBudget.findMany({
        where: {
          userId,
          month: { lte: month },
        },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          userId,
          status: "CONFIRMED",
          date: { lte: rangeEnd },
        },
        _sum: { amount: true },
      }),
    ]);

  const uncategorized = categories.find(
    (category) => category.name === "Uncategorized",
  );

  const spentByCategory = new Map<string, number>();
  for (const transaction of monthTransactions) {
    const categoryId =
      transaction.categoryId ?? uncategorized?.id ?? "uncategorized";
    const current = spentByCategory.get(categoryId) ?? 0;
    // Net: expenses increase spent, refunds/credits reduce it.
    spentByCategory.set(categoryId, current - transaction.amount);
  }
  for (const [categoryId, value] of spentByCategory) {
    spentByCategory.set(categoryId, Math.max(0, value));
  }

  const budgetByCategory = new Map(
    budgets.map((budget) => [budget.categoryId, budget.targetAmount]),
  );

  const allocatedTotalByCategory = new Map<string, number>();
  for (const budget of allBudgets) {
    const current = allocatedTotalByCategory.get(budget.categoryId) ?? 0;
    allocatedTotalByCategory.set(
      budget.categoryId,
      current + budget.targetAmount,
    );
  }

  const spentTotalByCategory = new Map<string, number>();
  for (const row of lifetimeFlows) {
    const categoryId = row.categoryId ?? uncategorized?.id;
    if (!categoryId) continue;
    const current = spentTotalByCategory.get(categoryId) ?? 0;
    spentTotalByCategory.set(
      categoryId,
      current + netOutflow(row._sum.amount),
    );
  }

  const categorySummaries: CategorySummary[] = categories
    .filter(
      (category) =>
        category.name !== "Income" && category.name !== "Transfer",
    )
    .map((category) => {
      const budgetStyle = (category.budgetStyle ??
        "MONTHLY") as CategoryBudgetStyle;
      const spent = spentByCategory.get(category.id) ?? 0;
      const target = budgetByCategory.get(category.id) ?? 0;
      const allocatedTotal = allocatedTotalByCategory.get(category.id) ?? 0;
      const spentTotal = spentTotalByCategory.get(category.id) ?? 0;
      const available = allocatedTotal - spentTotal;

      if (budgetStyle === "RESERVE") {
        const percentUsed =
          allocatedTotal > 0 ? (spentTotal / allocatedTotal) * 100 : 0;
        const variance = -available;
        const lowThreshold = Math.max(target * 0.2, 0);

        let status: CategorySummary["status"];
        if (allocatedTotal <= 0 && spentTotal <= 0) {
          status = "no_budget";
        } else if (available < 0) {
          status = "overspent";
        } else if (available === 0 && spentTotal > 0) {
          status = "warning";
        } else if (available > 0 && available <= lowThreshold && target > 0) {
          status = "warning";
        } else {
          status = "on_track";
        }

        return {
          categoryId: category.id,
          categoryName: category.name,
          icon: category.icon,
          color: category.color,
          budgetStyle,
          spent,
          target,
          allocatedTotal,
          spentTotal,
          available,
          variance,
          percentUsed,
          status,
          reserveState:
            available < 0
              ? "overdrawn"
              : available === 0 && spentTotal > 0
                ? "fully_drawn"
                : available > 0 && available <= lowThreshold && target > 0
                  ? "low"
                  : "healthy",
        };
      }

      const variance = spent - target;
      const percentUsed = target > 0 ? (spent / target) * 100 : 0;

      return {
        categoryId: category.id,
        categoryName: category.name,
        icon: category.icon,
        color: category.color,
        budgetStyle,
        spent,
        target,
        allocatedTotal: target,
        spentTotal: spent,
        available: target - spent,
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

  const monthlyCategories = categorySummaries.filter(
    (item) => item.budgetStyle === "MONTHLY",
  );
  const reserveCategories = categorySummaries.filter(
    (item) => item.budgetStyle === "RESERVE",
  );

  const totalSpent = monthlyCategories.reduce(
    (sum, item) => sum + item.spent,
    0,
  );
  const totalBudget = monthlyCategories.reduce(
    (sum, item) => sum + item.target,
    0,
  );
  const totalVariance = totalSpent - totalBudget;
  const totalReserveAvailable = reserveCategories.reduce(
    (sum, item) => sum + Math.max(item.available, 0),
    0,
  );
  const totalReserveAllocated = reserveCategories.reduce(
    (sum, item) => sum + item.allocatedTotal,
    0,
  );
  const totalReserveDrawn = reserveCategories.reduce(
    (sum, item) => sum + item.spentTotal,
    0,
  );
  const totalReserveDrawnThisMonth = reserveCategories.reduce(
    (sum, item) => sum + item.spent,
    0,
  );

  return {
    month,
    totalSpent,
    totalBudget,
    totalVariance,
    totalReserveAvailable,
    totalReserveAllocated,
    totalReserveDrawn,
    totalReserveDrawnThisMonth,
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
    if (category.budgetStyle === "RESERVE") {
      if (category.allocatedTotal <= 0) continue;

      if (category.available < 0) {
        alerts.push({
          userId,
          month,
          type: "OVERSPEND",
          categoryId: category.categoryId,
          message: `Drew more than allocated for ${category.categoryName} — short by $${Math.abs(category.available).toFixed(2)}.`,
        });
      }
      continue;
    }

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
