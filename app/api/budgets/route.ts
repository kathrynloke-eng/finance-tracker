import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { getCurrentMonthKey } from "@/lib/budget";

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
      targetAmount: Number(targetAmount),
      userId: user.id,
    },
    update: {
      targetAmount: Number(targetAmount),
    },
    include: { category: true },
  });

  return NextResponse.json({ budget });
}
