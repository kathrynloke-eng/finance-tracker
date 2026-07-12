import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_USER_NAME = "You";

/** Resolve the authenticated Clerk identity to this app's local data owner. */
export async function getDefaultUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthenticated request");
  }

  return prisma.user.upsert({
    where: { clerkId: userId },
    create: { clerkId: userId, name: DEFAULT_USER_NAME },
    update: {},
  });
}

export async function ensureDefaultData(userId: string) {
  const [accountCount, categoryCount] = await Promise.all([
    prisma.account.count({ where: { userId } }),
    prisma.category.count({ where: { userId } }),
  ]);

  if (accountCount === 0) {
    await prisma.account.createMany({
      data: [
        {
          name: "Main Checking",
          type: "CHECKING",
          userId,
          isTransferSource: true,
        },
        { name: "Savings", type: "SAVINGS", userId },
        { name: "Credit Card", type: "CREDIT_CARD", userId },
      ],
    });
  } else {
    const sourceCount = await prisma.account.count({
      where: { userId, isTransferSource: true },
    });
    if (sourceCount === 0) {
      const checking = await prisma.account.findFirst({
        where: { userId, type: "CHECKING" },
        orderBy: { createdAt: "asc" },
      });
      if (checking) {
        await prisma.account.update({
          where: { id: checking.id },
          data: { isTransferSource: true },
        });
      }
    }
  }

  if (categoryCount === 0) {
    const categories = [
      { name: "Food & Dining", icon: "🍽️", color: "#f97316" },
      { name: "Groceries", icon: "🛒", color: "#22c55e" },
      { name: "Transport", icon: "🚗", color: "#3b82f6" },
      { name: "Utilities", icon: "💡", color: "#eab308" },
      { name: "Rent & Housing", icon: "🏠", color: "#a855f7" },
      { name: "Entertainment", icon: "🎬", color: "#ec4899" },
      { name: "Shopping", icon: "🛍️", color: "#14b8a6" },
      { name: "Health", icon: "🏥", color: "#ef4444" },
      { name: "Subscriptions", icon: "📱", color: "#6366f1" },
      { name: "Income", icon: "💰", color: "#10b981" },
      { name: "Transfer", icon: "↔️", color: "#64748b" },
      { name: "Uncategorized", icon: "❓", color: "#94a3b8" },
    ];

    await prisma.category.createMany({
      data: categories.map((category) => ({
        ...category,
        userId,
        isDefault: true,
      })),
    });
  }

  const ruleCount = await prisma.categorizationRule.count({ where: { userId } });
  if (ruleCount === 0) {
    const createdCategories = await prisma.category.findMany({
      where: { userId },
    });

    const rules: Array<{ pattern: string; categoryName: string }> = [
      { pattern: "STARBUCKS", categoryName: "Food & Dining" },
      { pattern: "MCDONALD", categoryName: "Food & Dining" },
      { pattern: "GRAB", categoryName: "Transport" },
      { pattern: "UBER", categoryName: "Transport" },
      { pattern: "NETFLIX", categoryName: "Subscriptions" },
      { pattern: "SPOTIFY", categoryName: "Subscriptions" },
      { pattern: "SALARY", categoryName: "Income" },
      { pattern: "PAYROLL", categoryName: "Income" },
      { pattern: "TRANSFER", categoryName: "Transfer" },
    ];

    const categoryByName = new Map(
      createdCategories.map((category) => [category.name, category.id]),
    );

    const ruleData = rules
      .map((rule) => {
        const categoryId = categoryByName.get(rule.categoryName);
        if (!categoryId) return null;
        return { pattern: rule.pattern, categoryId, userId };
      })
      .filter((rule): rule is NonNullable<typeof rule> => rule !== null);

    if (ruleData.length > 0) {
      await prisma.categorizationRule.createMany({ data: ruleData });
    }
  }
}
