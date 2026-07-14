import { getAuthUserId, invalidateSessions, modifyAccountCredentials } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type PasswordResetTarget = { userId: Id<"users">; email: string };

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

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isConfiguredAdministrator(email: string | undefined) {
  return Boolean(email && configuredAdminEmails().has(email.trim().toLowerCase()));
}

function createTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = crypto.getRandomValues(new Uint32Array(20));
  const value = Array.from(values, (item) => alphabet[item % alphabet.length]).join("");
  return `FT-${value.slice(0, 5)}-${value.slice(5, 10)}-${value.slice(10, 15)}-${value.slice(15)}`;
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

export const isAdministrator = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    return isConfiguredAdministrator(user?.email);
  },
});

export const getPasswordResetTarget = internalQuery({
  args: { requesterId: v.id("users"), email: v.string() },
  handler: async (ctx, { requesterId, email }) => {
    const requester = await ctx.db.get(requesterId);
    if (!isConfiguredAdministrator(requester?.email)) {
      throw new Error("Administrator access is required.");
    }
    const target = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.trim()))
      .unique();
    if (!target?.email) {
      throw new Error("No account was found for that email address.");
    }
    return { userId: target._id, email: target.email };
  },
});

export const adminResetPassword = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const requesterId = await getAuthUserId(ctx);
    if (!requesterId) throw new Error("Administrator access is required.");
    const target: PasswordResetTarget = await ctx.runQuery(internal.users.getPasswordResetTarget, {
      requesterId,
      email,
    });
    const temporaryPassword = createTemporaryPassword();
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: target.email, secret: temporaryPassword },
    });
    await invalidateSessions(ctx, { userId: target.userId });
    return { email: target.email, temporaryPassword };
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
