import { prisma } from "@/lib/prisma";

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

export async function learnFromUserCorrection(
  userId: string,
  description: string,
  categoryId: string,
) {
  const token = description
    .toUpperCase()
    .split(/\s+/)
    .find((word) => word.length >= 4 && /^[A-Z0-9]+$/.test(word));

  if (!token) return;

  await prisma.categorizationRule.upsert({
    where: {
      userId_pattern: { userId, pattern: token },
    },
    create: { userId, pattern: token, categoryId },
    update: { categoryId },
  });
}
