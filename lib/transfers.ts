import { prisma } from "@/lib/prisma";
import { getFundingPlan } from "@/lib/funding";

export async function generateTransferSuggestions(userId: string, month: string) {
  const plan = await getFundingPlan(userId, month);

  await prisma.transferSuggestion.deleteMany({
    where: { userId, month, status: "SUGGESTED" },
  });

  // Replace prior transfer alerts so regenerations don't stack duplicates.
  await prisma.alert.deleteMany({
    where: { userId, month, type: "TRANSFER" },
  });

  if (!plan.sourceAccount || plan.transfers.length === 0) {
    return [];
  }

  const suggestions = plan.transfers.map((transfer) => ({
    userId,
    month,
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    amount: transfer.amount,
    reason:
      transfer.categoryNames.length > 0
        ? transfer.basis === "budget"
          ? `Allocate ${transfer.categoryNames.join(", ")} to ${transfer.toAccountName} ($${transfer.amount.toFixed(2)} reserved this month).`
          : transfer.basis === "mixed"
            ? `Fund ${transfer.categoryNames.join(", ")} via ${transfer.toAccountName} ($${transfer.amount.toFixed(2)} from spend + reserves).`
            : `Cover ${transfer.categoryNames.join(", ")} via ${transfer.toAccountName} ($${transfer.amount.toFixed(2)} spent).`
        : `Transfer $${transfer.amount.toFixed(2)} to ${transfer.toAccountName} for mapped categories.`,
  }));

  await prisma.transferSuggestion.createMany({ data: suggestions });

  await prisma.alert.create({
    data: {
      userId,
      month,
      type: "TRANSFER",
      message: `${suggestions.length} transfer suggestion${suggestions.length > 1 ? "s" : ""} ready based on category → account mapping.`,
    },
  });

  return suggestions;
}
