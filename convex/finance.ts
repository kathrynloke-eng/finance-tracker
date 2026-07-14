import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./users";

const accountType = v.union(
  v.literal("CHECKING"),
  v.literal("SAVINGS"),
  v.literal("CREDIT_CARD"),
);
const budgetStyle = v.union(v.literal("MONTHLY"), v.literal("RESERVE"));
const transactionStatus = v.union(
  v.literal("PENDING_REVIEW"),
  v.literal("CONFIRMED"),
);

function validMonth(month: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function normalizedText(value: string, min: number, max: number, label: string) {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) {
    throw new Error(`${label} must be ${min}–${max} characters.`);
  }
  return text;
}

async function ownedAccount(ctx: QueryCtx | MutationCtx, userId: Id<"users">, accountId: Id<"accounts">) {
  const account = await ctx.db.get(accountId);
  if (!account || account.userId !== userId) throw new Error("Account not found.");
  return account;
}

async function ownedCategory(ctx: QueryCtx | MutationCtx, userId: Id<"users">, categoryId: Id<"categories">) {
  const category = await ctx.db.get(categoryId);
  if (!category || category.userId !== userId) throw new Error("Category not found.");
  return category;
}

export const overview = query({
  args: { month: v.string() },
  handler: async (ctx, { month }) => {
    const userId = await requireUser(ctx);
    if (!validMonth(month)) throw new Error("Invalid month.");
    const [accounts, categories, budgets, transactions, statements, salaryPlan] = await Promise.all([
      ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("categories").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("monthlyBudgets").withIndex("by_user_month", (q) => q.eq("userId", userId).eq("month", month)).collect(),
      ctx.db.query("transactions").withIndex("by_user_date", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("statements").withIndex("by_user_uploaded", (q) => q.eq("userId", userId)).order("desc").collect(),
      ctx.db.query("monthlySalaryPlans").withIndex("by_user_month", (q) => q.eq("userId", userId).eq("month", month)).unique(),
    ]);
    const start = Date.parse(`${month}-01T00:00:00.000Z`);
    const next = new Date(start); next.setUTCMonth(next.getUTCMonth() + 1);
    const monthly = transactions.filter((item) => item.date >= start && item.date < next.getTime());
    const byCategory = new Map(categories.map((category) => [category._id, category]));
    const byAccount = new Map(accounts.map((account) => [account._id, account]));
    const targets = new Map(budgets.map((budget) => [budget.categoryId, budget.targetAmount]));
    const categoryRows = categories.map((category) => {
      const spent = monthly.filter((item) => item.categoryId === category._id && item.amount < 0)
        .reduce((sum, item) => sum + Math.abs(item.amount), 0);
      const target = targets.get(category._id) ?? 0;
      return { ...category, categoryId: category._id, spent, target, status: spent > target && target > 0 ? "OVER" : "ON_TRACK" };
    });
    const totalSpent = categoryRows.filter((row) => row.budgetStyle === "MONTHLY").reduce((sum, row) => sum + row.spent, 0);
    const totalBudget = categoryRows.filter((row) => row.budgetStyle === "MONTHLY").reduce((sum, row) => sum + row.target, 0);
    const transactionCounts = new Map<Id<"accounts">, number>();
    const statementCounts = new Map<Id<"accounts">, number>();
    for (const transaction of transactions) {
      transactionCounts.set(transaction.accountId, (transactionCounts.get(transaction.accountId) ?? 0) + 1);
    }
    for (const statement of statements) {
      statementCounts.set(statement.accountId, (statementCounts.get(statement.accountId) ?? 0) + 1);
    }
    return {
      accounts: accounts.map((account) => ({
        ...account,
        transactionCount: transactionCounts.get(account._id) ?? 0,
        statementCount: statementCounts.get(account._id) ?? 0,
      })),
      categories,
      budgets,
      salaryPlan,
      statements: statements.slice(0, 5),
      transactions: transactions.sort((a, b) => b.date - a.date).slice(0, 200).map((item) => ({ ...item, category: item.categoryId ? byCategory.get(item.categoryId) ?? null : null, account: byAccount.get(item.accountId) ?? null })),
      summary: { totalSpent, totalBudget, totalVariance: totalSpent - totalBudget, categories: categoryRows },
    };
  },
});

export const createAccount = mutation({
  args: { name: v.string(), type: accountType, currency: v.optional(v.string()), isTransferSource: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (args.isTransferSource) {
      const current = await ctx.db.query("accounts").withIndex("by_user_source", (q) => q.eq("userId", userId).eq("isTransferSource", true)).collect();
      await Promise.all(current.map((account) => ctx.db.patch(account._id, { isTransferSource: false })));
    }
    return await ctx.db.insert("accounts", { userId, name: normalizedText(args.name, 2, 60, "Account name"), type: args.type, currency: (args.currency ?? "USD").trim().toUpperCase().slice(0, 3) || "USD", isTransferSource: args.isTransferSource });
  },
});

export const updateAccount = mutation({
  args: { id: v.id("accounts"), name: v.optional(v.string()), type: v.optional(accountType), isTransferSource: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx); await ownedAccount(ctx, userId, args.id);
    if (args.isTransferSource) {
      const current = await ctx.db.query("accounts").withIndex("by_user_source", (q) => q.eq("userId", userId).eq("isTransferSource", true)).collect();
      await Promise.all(current.filter((account) => account._id !== args.id).map((account) => ctx.db.patch(account._id, { isTransferSource: false })));
    }
    await ctx.db.patch(args.id, { ...(args.name === undefined ? {} : { name: normalizedText(args.name, 2, 60, "Account name") }), ...(args.type === undefined ? {} : { type: args.type }), ...(args.isTransferSource === undefined ? {} : { isTransferSource: args.isTransferSource }) });
  },
});

export const deleteAccount = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx);
    const account = await ownedAccount(ctx, userId, id);

    // Transactions are financial history and must never be removed as a side
    // effect of deleting an account. Statement rows only contain processing
    // metadata, so they are safely removed when they have no transactions.
    const [transactions, statements, categories, accounts, recurring] = await Promise.all([
      ctx.db.query("transactions").withIndex("by_user_date", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("statements").withIndex("by_user_uploaded", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("categories").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("recurringTransactions").withIndex("by_user_next_occurrence", (q) => q.eq("userId", userId)).collect(),
    ]);
    if (transactions.some((transaction) => transaction.accountId === id)) {
      throw new Error("This account has transactions. Remove or reassign them before deleting the account.");
    }
    if (recurring.some((item) => item.accountId === id)) {
      throw new Error("This account has recurring schedules. Remove or reassign them before deleting the account.");
    }

    const nextTransferSource = account.isTransferSource
      ? accounts.find((candidate) => candidate._id !== id)
      : undefined;
    await Promise.all(
      [
        ...categories
          .filter((category) => category.fundingAccountId === id)
          .map((category) => ctx.db.patch(category._id, { fundingAccountId: undefined })),
        ...statements
          .filter((statement) => statement.accountId === id)
          .map((statement) => ctx.db.delete(statement._id)),
        ...(nextTransferSource
          ? [ctx.db.patch(nextTransferSource._id, { isTransferSource: true })]
          : []),
      ],
    );
    await ctx.db.delete(id);
    return { newTransferSourceId: nextTransferSource?._id ?? null };
  },
});

export const createCategory = mutation({
  args: { name: v.string(), icon: v.optional(v.string()), color: v.optional(v.string()), budgetStyle },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx); const name = normalizedText(args.name, 2, 40, "Category name");
    if (["Income", "Transfer", "Uncategorized"].includes(name)) throw new Error("That category name is reserved.");
    const duplicate = await ctx.db.query("categories").withIndex("by_user_name", (q) => q.eq("userId", userId).eq("name", name)).unique();
    if (duplicate) throw new Error("A category with that name already exists.");
    return await ctx.db.insert("categories", { userId, name, icon: args.icon?.slice(0, 8) || "📁", color: args.color?.slice(0, 16) || "#0ea5e9", isDefault: false, budgetStyle: args.budgetStyle });
  },
});

export const updateCategory = mutation({
  args: { id: v.id("categories"), name: v.optional(v.string()), icon: v.optional(v.string()), color: v.optional(v.string()), budgetStyle: v.optional(budgetStyle), fundingAccountId: v.optional(v.union(v.id("accounts"), v.null())) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx); const category = await ownedCategory(ctx, userId, args.id);
    if (["Income", "Transfer", "Uncategorized"].includes(category.name) && (args.name !== undefined || args.budgetStyle !== undefined || args.fundingAccountId !== undefined)) throw new Error("System categories cannot be changed or mapped.");
    if (args.fundingAccountId) await ownedAccount(ctx, userId, args.fundingAccountId);
    if (args.name) {
      const name = normalizedText(args.name, 2, 40, "Category name");
      const duplicate = await ctx.db.query("categories").withIndex("by_user_name", (q) => q.eq("userId", userId).eq("name", name)).unique();
      if (duplicate && duplicate._id !== args.id) throw new Error("A category with that name already exists.");
      await ctx.db.patch(args.id, { name });
    }
    await ctx.db.patch(args.id, { ...(args.icon === undefined ? {} : { icon: args.icon.slice(0, 8) }), ...(args.color === undefined ? {} : { color: args.color.slice(0, 16) }), ...(args.budgetStyle === undefined ? {} : { budgetStyle: args.budgetStyle }), ...(args.fundingAccountId === undefined ? {} : { fundingAccountId: args.fundingAccountId ?? undefined }) });
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx);
    const category = await ownedCategory(ctx, userId, id);
    if (["Income", "Transfer", "Uncategorized"].includes(category.name)) {
      throw new Error("System categories cannot be removed.");
    }

    const [budgets, rules, transactions] = await Promise.all([
      ctx.db.query("monthlyBudgets").withIndex("by_category_month", (q) => q.eq("categoryId", id)).collect(),
      ctx.db.query("categorizationRules").withIndex("by_user_pattern", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("transactions").withIndex("by_user_date", (q) => q.eq("userId", userId)).collect(),
    ]);
    await Promise.all([
      ...budgets.filter((budget) => budget.userId === userId).map((budget) => ctx.db.delete(budget._id)),
      ...rules.filter((rule) => rule.categoryId === id).map((rule) => ctx.db.delete(rule._id)),
      ...transactions.filter((transaction) => transaction.categoryId === id).map((transaction) => ctx.db.patch(transaction._id, { categoryId: undefined })),
    ]);
    await ctx.db.delete(id);
  },
});

export const setBudget = mutation({
  args: { categoryId: v.id("categories"), month: v.string(), targetAmount: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx); if (!validMonth(args.month) || !Number.isFinite(args.targetAmount) || args.targetAmount < 0) throw new Error("Invalid budget.");
    await ownedCategory(ctx, userId, args.categoryId);
    const existing = await ctx.db.query("monthlyBudgets").withIndex("by_category_month", (q) => q.eq("categoryId", args.categoryId).eq("month", args.month)).first();
    if (existing) { if (existing.userId !== userId) throw new Error("Unauthorized"); await ctx.db.patch(existing._id, { targetAmount: args.targetAmount }); return existing._id; }
    return await ctx.db.insert("monthlyBudgets", { userId, categoryId: args.categoryId, month: args.month, targetAmount: args.targetAmount });
  },
});

const salaryPlanArgs = {
  month: v.string(),
  income: v.number(),
  essentials: v.number(),
  lifestyle: v.number(),
  savings: v.number(),
  investments: v.number(),
  debtRepayment: v.number(),
  giving: v.number(),
  other: v.number(),
};

export const saveSalaryPlan = mutation({
  args: salaryPlanArgs,
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!validMonth(args.month)) throw new Error("Invalid month.");
    const values = [
      args.income,
      args.essentials,
      args.lifestyle,
      args.savings,
      args.investments,
      args.debtRepayment,
      args.giving,
      args.other,
    ];
    if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1_000_000_000)) {
      throw new Error("Allocation amounts must be valid positive numbers.");
    }
    const existing = await ctx.db
      .query("monthlySalaryPlans")
      .withIndex("by_user_month", (q) => q.eq("userId", userId).eq("month", args.month))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        income: args.income,
        essentials: args.essentials,
        lifestyle: args.lifestyle,
        savings: args.savings,
        investments: args.investments,
        debtRepayment: args.debtRepayment,
        giving: args.giving,
        other: args.other,
      });
      return existing._id;
    }
    return await ctx.db.insert("monthlySalaryPlans", { userId, ...args });
  },
});

export const createTransaction = mutation({
  args: { date: v.number(), description: v.string(), amount: v.number(), accountId: v.id("accounts"), categoryId: v.optional(v.id("categories")), status: v.optional(transactionStatus) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx); if (!Number.isFinite(args.date) || !Number.isFinite(args.amount) || args.amount === 0) throw new Error("Invalid transaction.");
    await ownedAccount(ctx, userId, args.accountId); if (args.categoryId) await ownedCategory(ctx, userId, args.categoryId);
    return await ctx.db.insert("transactions", { userId, date: args.date, description: normalizedText(args.description, 2, 200, "Description"), amount: args.amount, accountId: args.accountId, ...(args.categoryId ? { categoryId: args.categoryId } : {}), status: args.status ?? "CONFIRMED", confidence: 1 });
  },
});

export const updateTransaction = mutation({
  args: { id: v.id("transactions"), date: v.optional(v.number()), description: v.optional(v.string()), amount: v.optional(v.number()), accountId: v.optional(v.id("accounts")), categoryId: v.optional(v.union(v.id("categories"), v.null())), status: v.optional(transactionStatus) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx); const transaction = await ctx.db.get(args.id); if (!transaction || transaction.userId !== userId) throw new Error("Transaction not found.");
    if (args.accountId) await ownedAccount(ctx, userId, args.accountId); if (args.categoryId) await ownedCategory(ctx, userId, args.categoryId);
    if (args.amount !== undefined && (!Number.isFinite(args.amount) || args.amount === 0)) throw new Error("Invalid amount.");
    await ctx.db.patch(args.id, { ...(args.date === undefined ? {} : { date: args.date }), ...(args.description === undefined ? {} : { description: normalizedText(args.description, 2, 200, "Description") }), ...(args.amount === undefined ? {} : { amount: args.amount }), ...(args.accountId === undefined ? {} : { accountId: args.accountId }), ...(args.categoryId === undefined ? {} : { categoryId: args.categoryId ?? undefined }), ...(args.status === undefined ? {} : { status: args.status }) });
  },
});

export const deleteTransactions = mutation({
  args: { ids: v.array(v.id("transactions")) },
  handler: async (ctx, { ids }) => {
    const userId = await requireUser(ctx); let deletedCount = 0;
    for (const id of new Set(ids)) { const transaction = await ctx.db.get(id); if (transaction?.userId === userId) { await ctx.db.delete(id); deletedCount++; } }
    return deletedCount;
  },
});

export const redactStatementFilenames = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const statements = await ctx.db
      .query("statements")
      .withIndex("by_user_uploaded", (q) => q.eq("userId", userId))
      .collect();
    const toRedact = statements.filter(
      (statement) => statement.fileName !== "Imported statement",
    );
    await Promise.all(
      toRedact.map((statement) =>
        ctx.db.patch(statement._id, { fileName: "Imported statement" }),
      ),
    );
    return toRedact.length;
  },
});

export const importParsedStatement = mutation({
  args: {
    accountId: v.id("accounts"), mimeType: v.string(),
    transactions: v.array(v.object({ date: v.number(), description: v.string(), amount: v.number(), dedupeHash: v.string() })),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await ownedAccount(ctx, userId, args.accountId);
    if (args.transactions.length === 0 || args.transactions.length > 2_000) throw new Error("No valid transactions were found in this statement.");
    const statementId = await ctx.db.insert("statements", { userId, accountId: args.accountId, fileName: "Imported statement", mimeType: "application/pdf", status: "PROCESSING" });
    let createdCount = 0;
    for (const item of args.transactions) {
      if (!Number.isFinite(item.date) || !Number.isFinite(item.amount) || item.amount === 0) continue;
      const duplicate = await ctx.db.query("transactions").withIndex("by_user_dedupe", (q) => q.eq("userId", userId).eq("dedupeHash", item.dedupeHash)).first();
      if (duplicate) continue;
      await ctx.db.insert("transactions", { userId, date: item.date, description: normalizedText(item.description, 2, 200, "Description"), amount: item.amount, accountId: args.accountId, statementId, status: "PENDING_REVIEW", confidence: 0, dedupeHash: item.dedupeHash });
      createdCount++;
    }
    const dates = args.transactions.map((item) => item.date);
    await ctx.db.patch(statementId, { status: "PARSED", periodStart: Math.min(...dates), periodEnd: Math.max(...dates) });
    return { statementId, createdCount };
  },
});
