import { prisma } from "@/lib/prisma";
import { getCurrentMonthKey } from "@/lib/budget";
import { monthKeyToLocalRange } from "@/lib/dates";

const EXCLUDED = new Set(["Income", "Transfer", "Uncategorized"]);

export type AccountFundingPlan = {
  accountId: string;
  accountName: string;
  accountType: string;
  spentAmount: number;
  budgetAmount: number;
  transferAmount: number;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    icon: string | null;
    spent: number;
    budget: number;
    budgetStyle: "MONTHLY" | "RESERVE";
    transferAmount: number;
  }>;
};

export type FundingPlan = {
  month: string;
  sourceAccount: {
    id: string;
    name: string;
    type: string;
  } | null;
  unassigned: {
    spentAmount: number;
    budgetAmount: number;
    categories: Array<{
      categoryId: string;
      categoryName: string;
      icon: string | null;
      spent: number;
      budget: number;
      budgetStyle: "MONTHLY" | "RESERVE";
      transferAmount: number;
    }>;
  };
  accounts: AccountFundingPlan[];
  transfers: Array<{
    fromAccountId: string;
    fromAccountName: string;
    toAccountId: string;
    toAccountName: string;
    amount: number;
    basis: "spent" | "budget" | "mixed";
    categoryNames: string[];
  }>;
};

function categoryTransferAmount(
  budgetStyle: "MONTHLY" | "RESERVE",
  spent: number,
  budget: number,
) {
  // Reserves: move the monthly allocation even if you haven't drawn yet.
  // Monthly spend categories: move what was actually spent.
  return budgetStyle === "RESERVE" ? budget : spent;
}

export async function getFundingPlan(
  userId: string,
  month = getCurrentMonthKey(),
): Promise<FundingPlan> {
  const { start: rangeStart, end: rangeEnd } = monthKeyToLocalRange(month);

  const [accounts, categories, budgets, transactions] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    }),
    prisma.monthlyBudget.findMany({
      where: { userId, month },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: rangeStart, lte: rangeEnd },
        status: "CONFIRMED",
      },
    }),
  ]);

  const budgetByCategory = new Map(
    budgets.map((budget) => [budget.categoryId, budget.targetAmount]),
  );

  const spentByCategory = new Map<string, number>();
  for (const transaction of transactions) {
    if (!transaction.categoryId) continue;
    const current = spentByCategory.get(transaction.categoryId) ?? 0;
    spentByCategory.set(
      transaction.categoryId,
      current - transaction.amount,
    );
  }
  for (const [categoryId, value] of spentByCategory) {
    spentByCategory.set(categoryId, Math.max(0, value));
  }

  const expenseCategories = categories.filter(
    (category) => !EXCLUDED.has(category.name),
  );

  const sourceAccount =
    accounts.find((account) => account.isTransferSource) ??
    accounts.find((account) => account.type === "CHECKING") ??
    null;

  const accountPlans: AccountFundingPlan[] = accounts.map((account) => ({
    accountId: account.id,
    accountName: account.name,
    accountType: account.type,
    spentAmount: 0,
    budgetAmount: 0,
    transferAmount: 0,
    categories: [],
  }));

  const planByAccount = new Map(
    accountPlans.map((plan) => [plan.accountId, plan]),
  );

  const unassigned: FundingPlan["unassigned"] = {
    spentAmount: 0,
    budgetAmount: 0,
    categories: [],
  };

  for (const category of expenseCategories) {
    const spent = spentByCategory.get(category.id) ?? 0;
    const budget = budgetByCategory.get(category.id) ?? 0;
    const budgetStyle: "MONTHLY" | "RESERVE" =
      category.budgetStyle === "RESERVE" ? "RESERVE" : "MONTHLY";
    const transferAmount = categoryTransferAmount(budgetStyle, spent, budget);
    const entry: {
      categoryId: string;
      categoryName: string;
      icon: string | null;
      spent: number;
      budget: number;
      budgetStyle: "MONTHLY" | "RESERVE";
      transferAmount: number;
    } = {
      categoryId: category.id,
      categoryName: category.name,
      icon: category.icon,
      spent,
      budget,
      budgetStyle,
      transferAmount,
    };

    if (category.fundingAccountId && planByAccount.has(category.fundingAccountId)) {
      const plan = planByAccount.get(category.fundingAccountId)!;
      plan.categories.push(entry);
      plan.spentAmount += spent;
      plan.budgetAmount += budget;
      plan.transferAmount += transferAmount;
    } else {
      unassigned.categories.push(entry);
      unassigned.spentAmount += spent;
      unassigned.budgetAmount += budget;
    }
  }

  const transfers: FundingPlan["transfers"] = [];

  if (sourceAccount) {
    for (const plan of accountPlans) {
      if (plan.accountId === sourceAccount.id) continue;

      const amount = Math.round(plan.transferAmount * 100) / 100;
      if (amount <= 0) continue;

      const styles = new Set(
        plan.categories.map((category) => category.budgetStyle),
      );
      const basis =
        styles.size === 1
          ? styles.has("RESERVE")
            ? "budget"
            : "spent"
          : "mixed";

      transfers.push({
        fromAccountId: sourceAccount.id,
        fromAccountName: sourceAccount.name,
        toAccountId: plan.accountId,
        toAccountName: plan.accountName,
        amount,
        basis,
        categoryNames: plan.categories
          .filter((category) => category.transferAmount > 0)
          .map((category) => category.categoryName),
      });
    }
  }

  return {
    month,
    sourceAccount: sourceAccount
      ? {
          id: sourceAccount.id,
          name: sourceAccount.name,
          type: sourceAccount.type,
        }
      : null,
    unassigned,
    accounts: accountPlans,
    transfers,
  };
}
