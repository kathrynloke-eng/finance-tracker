import { prisma } from "@/lib/prisma";
import { getCurrentMonthKey } from "@/lib/budget";

export type CategoryMatch = {
  categoryId: string;
  confidence: number;
};

export async function categorizeTransaction(
  userId: string,
  description: string,
): Promise<CategoryMatch | null> {
  const rules = await prisma.categorizationRule.findMany({
    where: { userId },
    include: { category: true },
  });

  const upperDescription = description.toUpperCase();

  for (const rule of rules) {
    if (upperDescription.includes(rule.pattern.toUpperCase())) {
      return { categoryId: rule.categoryId, confidence: 0.9 };
    }
  }

  const uncategorized = await prisma.category.findFirst({
    where: { userId, name: "Uncategorized" },
  });

  if (!uncategorized) return null;

  return { categoryId: uncategorized.id, confidence: 0.3 };
}

function extractLearnToken(description: string) {
  return description
    .toUpperCase()
    .split(/\s+/)
    .find((word) => word.length >= 4 && /^[A-Z0-9]+$/.test(word));
}

/**
 * Learn a merchant token → category rule, and apply it to matching
 * pending/uncategorized transactions only.
 * Returns months that need alert/transfer refresh.
 */
export async function learnFromUserCorrection(
  userId: string,
  description: string,
  categoryId: string,
): Promise<string[]> {
  const token = extractLearnToken(description);
  if (!token) return [];

  await prisma.categorizationRule.upsert({
    where: {
      userId_pattern: { userId, pattern: token },
    },
    create: { userId, pattern: token, categoryId },
    update: { categoryId },
  });

  const uncategorized = await prisma.category.findFirst({
    where: { userId, name: "Uncategorized" },
  });

  const candidates = await prisma.transaction.findMany({
    where: {
      userId,
      OR: [
        { status: "PENDING_REVIEW" },
        ...(uncategorized ? [{ categoryId: uncategorized.id }] : []),
        { categoryId: null },
      ],
    },
    select: { id: true, description: true, date: true },
  });

  const matching = candidates.filter((transaction) =>
    transaction.description.toUpperCase().includes(token),
  );

  if (matching.length === 0) return [];

  await prisma.transaction.updateMany({
    where: { id: { in: matching.map((transaction) => transaction.id) } },
    data: {
      categoryId,
      status: "CONFIRMED",
      confidence: 0.9,
    },
  });

  return [
    ...new Set(matching.map((transaction) => getCurrentMonthKey(transaction.date))),
  ];
}
