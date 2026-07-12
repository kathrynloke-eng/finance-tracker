import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { getCurrentMonthKey, syncBudgetAlerts } from "@/lib/budget";
import { generateTransferSuggestions } from "@/lib/transfers";
import { revalidateFinancePages } from "@/lib/revalidate";
import { isValidMonthKey } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const month =
    request.nextUrl.searchParams.get("month") ?? getCurrentMonthKey();

  const budgets = await prisma.monthlyBudget.findMany({
    where: { userId: user.id, month },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });

  return NextResponse.json({ month, budgets });
}

export async function POST(request: NextRequest) {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const body = await request.json();
  const { categoryId, month, targetAmount } = body;

  if (!categoryId || !month || targetAmount === undefined) {
    return NextResponse.json(
      { error: "categoryId, month, and targetAmount are required." },
      { status: 400 },
    );
  }

  if (typeof categoryId !== "string" || !isValidMonthKey(month)) {
    return NextResponse.json(
      { error: "categoryId and a valid month (YYYY-MM) are required." },
      { status: 400 },
    );
  }

  const amount = typeof targetAmount === "number" ? targetAmount : Number(targetAmount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json(
      { error: "targetAmount must be a non-negative number." },
      { status: 400 },
    );
  }

  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId: user.id },
    select: { id: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  const budget = await prisma.monthlyBudget.upsert({
    where: {
      categoryId_month_userId: {
        categoryId,
        month,
        userId: user.id,
      },
    },
    create: {
      categoryId,
      month,
      targetAmount: amount,
      userId: user.id,
    },
    update: {
      targetAmount: amount,
    },
    include: { category: true },
  });

  await syncBudgetAlerts(user.id, month);
  await generateTransferSuggestions(user.id, month);
  revalidateFinancePages();

  return NextResponse.json({ budget });
}
