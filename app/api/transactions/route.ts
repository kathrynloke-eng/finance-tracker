import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { learnFromUserCorrection } from "@/lib/categorizer";
import { syncBudgetAlerts, getCurrentMonthKey } from "@/lib/budget";
import { generateTransferSuggestions } from "@/lib/transfers";
import { parseDateInput, monthKeyToLocalRange } from "@/lib/dates";
import { revalidateFinancePages } from "@/lib/revalidate";

function parseAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return amount;
}

function parseDate(value: unknown) {
  return parseDateInput(value);
}

function buildManualDedupeHash(
  accountId: string,
  date: Date,
  description: string,
  amount: number,
) {
  const payload = `manual|${accountId}|${format(date, "yyyy-MM-dd")}|${description.toLowerCase()}|${amount}|${Date.now()}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

async function refreshMonthDerivedData(userId: string, date: Date) {
  const month = getCurrentMonthKey(date);
  await syncBudgetAlerts(userId, month);
  await generateTransferSuggestions(userId, month);
  revalidateFinancePages();
  return month;
}

async function refreshMonths(userId: string, months: Iterable<string>) {
  for (const month of months) {
    await syncBudgetAlerts(userId, month);
    await generateTransferSuggestions(userId, month);
  }
  revalidateFinancePages();
}

export async function GET(request: NextRequest) {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const status = request.nextUrl.searchParams.get("status");
  const month = request.nextUrl.searchParams.get("month");

  const where: {
    userId: string;
    status?: "PENDING_REVIEW" | "CONFIRMED";
    date?: { gte: Date; lte: Date };
  } = { userId: user.id };

  if (status === "PENDING_REVIEW" || status === "CONFIRMED") {
    where.status = status;
  }

  if (month) {
    const { start: monthDate, end: rangeEnd } = monthKeyToLocalRange(month);
    where.date = { gte: monthDate, lte: rangeEnd };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      category: true,
      account: true,
      statement: true,
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return NextResponse.json({ transactions });
}

export async function POST(request: NextRequest) {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const body = await request.json();
  const description =
    typeof body.description === "string"
      ? body.description.trim().replace(/\s+/g, " ")
      : "";
  const amount = parseAmount(body.amount);
  const date = parseDate(body.date);
  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  const categoryId =
    typeof body.categoryId === "string" && body.categoryId
      ? body.categoryId
      : null;

  if (description.length < 2) {
    return NextResponse.json(
      { error: "Description must be at least 2 characters." },
      { status: 400 },
    );
  }

  if (amount === null) {
    return NextResponse.json(
      { error: "Enter a non-zero amount. Use negative for expenses." },
      { status: 400 },
    );
  }

  if (!date) {
    return NextResponse.json({ error: "Enter a valid date." }, { status: 400 });
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: user.id },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: user.id },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }
  }

  const transaction = await prisma.transaction.create({
    data: {
      date,
      description,
      amount,
      accountId: account.id,
      categoryId,
      userId: user.id,
      status: "CONFIRMED",
      confidence: 1,
      dedupeHash: buildManualDedupeHash(account.id, date, description, amount),
    },
    include: {
      category: true,
      account: true,
    },
  });

  if (categoryId) {
    const learnedMonths = await learnFromUserCorrection(
      user.id,
      description,
      categoryId,
    );
    await refreshMonths(user.id, [
      getCurrentMonthKey(date),
      ...learnedMonths,
    ]);
  } else {
    await refreshMonthDerivedData(user.id, date);
  }

  return NextResponse.json(
    { transaction, month: getCurrentMonthKey(date) },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const user = await getDefaultUser();
  const body = await request.json();
  const { id } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Transaction id is required." }, { status: 400 });
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  const data: {
    date?: Date;
    description?: string;
    amount?: number;
    categoryId?: string | null;
    accountId?: string;
    status?: "PENDING_REVIEW" | "CONFIRMED";
  } = {};

  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.trim().length < 2) {
      return NextResponse.json(
        { error: "Description must be at least 2 characters." },
        { status: 400 },
      );
    }
    data.description = body.description.trim().replace(/\s+/g, " ");
  }

  if (body.amount !== undefined) {
    const amount = parseAmount(body.amount);
    if (amount === null) {
      return NextResponse.json(
        { error: "Enter a non-zero amount. Use negative for expenses." },
        { status: 400 },
      );
    }
    data.amount = amount;
  }

  if (body.date !== undefined) {
    const date = parseDate(body.date);
    if (!date) {
      return NextResponse.json({ error: "Enter a valid date." }, { status: 400 });
    }
    data.date = date;
  }

  if (body.accountId !== undefined) {
    if (typeof body.accountId !== "string") {
      return NextResponse.json({ error: "Account is required." }, { status: 400 });
    }
    const account = await prisma.account.findFirst({
      where: { id: body.accountId, userId: user.id },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    data.accountId = account.id;
  }

  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === "") {
      data.categoryId = null;
    } else if (typeof body.categoryId === "string") {
      const category = await prisma.category.findFirst({
        where: { id: body.categoryId, userId: user.id },
      });
      if (!category) {
        return NextResponse.json({ error: "Category not found." }, { status: 404 });
      }
      data.categoryId = category.id;
    }
  }

  if (body.status === "PENDING_REVIEW" || body.status === "CONFIRMED") {
    data.status = body.status;
  } else if (
    data.categoryId !== undefined ||
    data.description !== undefined ||
    data.amount !== undefined
  ) {
    data.status = "CONFIRMED";
  }

  const transaction = await prisma.transaction.update({
    where: { id },
    data,
    include: {
      category: true,
      account: true,
    },
  });

  if (
    data.categoryId &&
    data.categoryId !== existing.categoryId &&
    typeof data.categoryId === "string"
  ) {
    const learnedMonths = await learnFromUserCorrection(
      user.id,
      transaction.description,
      data.categoryId,
    );
    await refreshMonths(user.id, [
      getCurrentMonthKey(existing.date),
      getCurrentMonthKey(transaction.date),
      ...learnedMonths,
    ]);
  } else {
    const months = new Set([
      getCurrentMonthKey(existing.date),
      getCurrentMonthKey(transaction.date),
    ]);
    await refreshMonths(user.id, months);
  }

  return NextResponse.json({
    transaction,
    month: format(transaction.date, "yyyy-MM"),
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getDefaultUser();

  let ids: string[] = [];
  const singleId = request.nextUrl.searchParams.get("id");
  if (singleId) {
    ids = [singleId];
  } else {
    try {
      const body = await request.json();
      if (Array.isArray(body.ids)) {
        ids = body.ids.filter(
          (value: unknown): value is string =>
            typeof value === "string" && value.length > 0,
        );
      }
    } catch {
      ids = [];
    }
  }

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Provide a transaction id or ids array." },
      { status: 400 },
    );
  }

  const existing = await prisma.transaction.findMany({
    where: { userId: user.id, id: { in: ids } },
  });

  if (existing.length === 0) {
    return NextResponse.json({ error: "No matching transactions found." }, { status: 404 });
  }

  const months = new Set(
    existing.map((transaction) => getCurrentMonthKey(transaction.date)),
  );

  await prisma.transaction.deleteMany({
    where: {
      userId: user.id,
      id: { in: existing.map((transaction) => transaction.id) },
    },
  });

  await refreshMonths(user.id, months);

  return NextResponse.json({
    ok: true,
    deletedCount: existing.length,
  });
}
