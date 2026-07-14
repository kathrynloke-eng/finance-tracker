import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const defaultCategories = [
  ["Food & Dining", "🍽️", "#f97316"],
  ["Groceries", "🛒", "#22c55e"],
  ["Transport", "🚗", "#3b82f6"],
  ["Utilities", "💡", "#eab308"],
  ["Rent & Housing", "🏠", "#a855f7"],
  ["Entertainment", "🎬", "#ec4899"],
  ["Shopping", "🛍️", "#14b8a6"],
  ["Health", "🏥", "#ef4444"],
  ["Subscriptions", "📱", "#6366f1"],
  ["Income", "💰", "#10b981"],
  ["Transfer", "↔️", "#64748b"],
  ["Uncategorized", "❓", "#94a3b8"],
] as const;

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const initialize = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) return existing._id;

    await ctx.db.insert("profiles", { userId, name: "You" });
    const checkingId = await ctx.db.insert("accounts", {
      userId,
      name: "Main Checking",
      type: "CHECKING",
      currency: "USD",
      isTransferSource: true,
    });
    await ctx.db.insert("accounts", {
      userId,
      name: "Savings",
      type: "SAVINGS",
      currency: "USD",
      isTransferSource: false,
    });
    await ctx.db.insert("accounts", {
      userId,
      name: "Credit Card",
      type: "CREDIT_CARD",
      currency: "USD",
      isTransferSource: false,
    });

    for (const [name, icon, color] of defaultCategories) {
      await ctx.db.insert("categories", {
        userId,
        name,
        icon,
        color,
        isDefault: true,
        budgetStyle: "MONTHLY",
        ...(name === "Transfer" ? { fundingAccountId: checkingId } : {}),
      });
    }
  },
});
