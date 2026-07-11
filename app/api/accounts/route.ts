import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";

export async function GET() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ accounts });
}
