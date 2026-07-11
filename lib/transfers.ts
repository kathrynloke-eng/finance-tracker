import { prisma } from "@/lib/prisma";
import { getMonthlySummary } from "@/lib/budget";

export async function generateTransferSuggestions(userId: string, month: string) {
  const summary = await getMonthlySummary(userId, month);

  const accounts = await prisma.account.findMany({
    where: { userId },
  });

  const checking = accounts.find((account) => account.type === "CHECKING");
  const savings = accounts.find((account) => account.type === "SAVINGS");
  const creditCard = accounts.find((account) => account.type === "CREDIT_CARD");

  if (!checking) return [];

  await prisma.transferSuggestion.deleteMany({
    where: { userId, month, status: "SUGGESTED" },
  });

  const suggestions: Array<{
    userId: string;
    month: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    reason: string;
  }> = [];

  const creditCardSpend = summary.categories.reduce((sum, category) => sum + category.spent, 0);

  if (creditCard && creditCardSpend > 0) {
    suggestions.push({
      userId,
      month,
      fromAccountId: checking.id,
      toAccountId: creditCard.id,
      amount: Math.round(creditCardSpend * 100) / 100,
      reason: `Pay credit card balance from checking based on $${creditCardSpend.toFixed(2)} in monthly expenses.`,
    });
  }

  if (savings && summary.totalVariance < 0) {
    const surplus = Math.abs(summary.totalVariance);
    if (surplus >= 50) {
      suggestions.push({
        userId,
        month,
        fromAccountId: checking.id,
        toAccountId: savings.id,
        amount: Math.round(surplus * 100) / 100,
        reason: `Move surplus to savings — you are $${surplus.toFixed(2)} under total budget.`,
      });
    }
  }

  if (suggestions.length > 0) {
    await prisma.transferSuggestion.createMany({ data: suggestions });

    await prisma.alert.create({
      data: {
        userId,
        month,
        type: "TRANSFER",
        message: `${suggestions.length} transfer suggestion${suggestions.length > 1 ? "s" : ""} ready for review.`,
      },
    });
  }

  return suggestions;
}
