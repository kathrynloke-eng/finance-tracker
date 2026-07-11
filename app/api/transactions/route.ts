import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { learnFromUserCorrection } from "@/lib/categorizer";
import { syncBudgetAlerts } from "@/lib/budget";
import { getCurrentMonthKey } from "@/lib/budget";
import { format } from "date-fns";

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
    const monthDate = new Date(`${month}-01`);
    const rangeEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
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

export async function PATCH(request: NextRequest) {
  const user = await getDefaultUser();
  const body = await request.json();
  const { id, categoryId, status } = body;

  if (!id) {
    return NextResponse.json({ error: "Transaction id is required." }, { status: 400 });
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      categoryId: categoryId ?? existing.categoryId,
      status: status ?? "CONFIRMED",
    },
    include: { category: true },
  });

  if (categoryId && categoryId !== existing.categoryId) {
    await learnFromUserCorrection(user.id, existing.description, categoryId);
  }

  const month = getCurrentMonthKey(transaction.date);
  await syncBudgetAlerts(user.id, month);

  return NextResponse.json({
    transaction,
    month: format(transaction.date, "yyyy-MM"),
  });
}
