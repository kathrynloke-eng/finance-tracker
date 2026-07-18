import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const accountType = v.union(
  v.literal("CHECKING"),
  v.literal("SAVINGS"),
  v.literal("CREDIT_CARD"),
);

const budgetStyle = v.union(v.literal("MONTHLY"), v.literal("RESERVE"));
const allocationExpenseGroup = v.union(
  v.literal("ESSENTIALS"),
  v.literal("LIFESTYLE"),
  v.literal("GIVING"),
);

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
  }).index("by_user", ["userId"]),

  accounts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: accountType,
    currency: v.string(),
    isTransferSource: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_source", ["userId", "isTransferSource"]),

  categories: defineTable({
    userId: v.id("users"),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    isDefault: v.boolean(),
    budgetStyle,
    allocationExpenseGroup: v.optional(allocationExpenseGroup),
    fundingAccountId: v.optional(v.id("accounts")),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  monthlyBudgets: defineTable({
    userId: v.id("users"),
    categoryId: v.id("categories"),
    month: v.string(),
    targetAmount: v.number(),
  })
    .index("by_user_month", ["userId", "month"])
    .index("by_category_month", ["categoryId", "month"]),

  monthlySalaryPlans: defineTable({
    userId: v.id("users"),
    month: v.string(),
    income: v.number(),
    essentials: v.number(),
    lifestyle: v.number(),
    savings: v.number(),
    investments: v.number(),
    debtRepayment: v.number(),
    giving: v.number(),
    other: v.number(),
  }).index("by_user_month", ["userId", "month"]),

  statements: defineTable({
    userId: v.id("users"),
    accountId: v.id("accounts"),
    fileName: v.string(),
    mimeType: v.string(),
    status: v.union(v.literal("PROCESSING"), v.literal("PARSED"), v.literal("FAILED")),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_user_uploaded", ["userId"])
    .index("by_user_account", ["userId", "accountId"]),

  transactions: defineTable({
    userId: v.id("users"),
    date: v.number(),
    description: v.string(),
    amount: v.number(),
    accountId: v.id("accounts"),
    categoryId: v.optional(v.id("categories")),
    statementId: v.optional(v.id("statements")),
    status: v.union(v.literal("PENDING_REVIEW"), v.literal("CONFIRMED")),
    confidence: v.optional(v.number()),
    dedupeHash: v.optional(v.string()),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_account", ["userId", "accountId"])
    .index("by_user_dedupe", ["userId", "dedupeHash"]),

  recurringTransactions: defineTable({
    userId: v.id("users"),
    description: v.string(),
    amount: v.number(),
    frequency: v.union(v.literal("WEEKLY"), v.literal("MONTHLY"), v.literal("YEARLY")),
    interval: v.number(),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    nextOccurrence: v.number(),
    isActive: v.boolean(),
    accountId: v.id("accounts"),
    categoryId: v.optional(v.id("categories")),
  }).index("by_user_next_occurrence", ["userId", "nextOccurrence"]),

  categorizationRules: defineTable({
    userId: v.id("users"),
    pattern: v.string(),
    categoryId: v.id("categories"),
  }).index("by_user_pattern", ["userId", "pattern"]),
});
