import { prisma } from "@/lib/prisma";

const DEFAULT_USER_NAME = "You";

export async function getDefaultUser() {
  const existing = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: { name: DEFAULT_USER_NAME },
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
        { name: "Main Checking", type: "CHECKING", userId },
        { name: "Savings", type: "SAVINGS", userId },
        { name: "Credit Card", type: "CREDIT_CARD", userId },
      ],
    });
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
