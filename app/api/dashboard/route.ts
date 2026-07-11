import { NextRequest, NextResponse } from "next/server";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { getMonthlySummary, getCurrentMonthKey } from "@/lib/budget";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const month =
    request.nextUrl.searchParams.get("month") ?? getCurrentMonthKey();

  const [summary, alerts, transfers, pendingCount] = await Promise.all([
    getMonthlySummary(user.id, month),
    prisma.alert.findMany({
      where: { userId: user.id, month },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.transferSuggestion.findMany({
      where: { userId: user.id, month, status: "SUGGESTED" },
      include: { fromAccount: true, toAccount: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.count({
      where: { userId: user.id, status: "PENDING_REVIEW" },
    }),
  ]);

  return NextResponse.json({
    month,
    summary,
    alerts,
    transfers,
    pendingCount,
  });
}
