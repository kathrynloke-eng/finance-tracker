import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";

const ACCOUNT_TYPES = new Set(["CHECKING", "SAVINGS", "CREDIT_CARD"]);

export async function GET() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    include: {
      fundedCategories: {
        select: { id: true, name: true, icon: true, color: true },
        orderBy: { name: "asc" },
      },
      _count: { select: { transactions: true, statements: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const body = await request.json();
  const name =
    typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const type = body.type;

  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Account name must be 2–60 characters." },
      { status: 400 },
    );
  }

  if (!ACCOUNT_TYPES.has(type)) {
    return NextResponse.json(
      { error: "Account type must be CHECKING, SAVINGS, or CREDIT_CARD." },
      { status: 400 },
    );
  }

  const makeSource = Boolean(body.isTransferSource);
  if (makeSource) {
    await prisma.account.updateMany({
      where: { userId: user.id, isTransferSource: true },
      data: { isTransferSource: false },
    });
  }

  const account = await prisma.account.create({
    data: {
      name,
      type,
      userId: user.id,
      isTransferSource: makeSource,
      currency:
        typeof body.currency === "string" && body.currency.trim()
          ? body.currency.trim().toUpperCase().slice(0, 3)
          : "USD",
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getDefaultUser();
  const body = await request.json();
  const { id } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Account id is required." }, { status: 400 });
  }

  const existing = await prisma.account.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const data: {
    name?: string;
    type?: "CHECKING" | "SAVINGS" | "CREDIT_CARD";
    isTransferSource?: boolean;
  } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60) {
      return NextResponse.json(
        { error: "Account name must be 2–60 characters." },
        { status: 400 },
      );
    }
    data.name = name;
  }

  if (body.type !== undefined) {
    if (!ACCOUNT_TYPES.has(body.type)) {
      return NextResponse.json({ error: "Invalid account type." }, { status: 400 });
    }
    data.type = body.type;
  }

  if (body.isTransferSource === true) {
    await prisma.account.updateMany({
      where: { userId: user.id, isTransferSource: true },
      data: { isTransferSource: false },
    });
    data.isTransferSource = true;
  } else if (body.isTransferSource === false) {
    data.isTransferSource = false;
  }

  const account = await prisma.account.update({
    where: { id },
    data,
  });

  return NextResponse.json({ account });
}

export async function DELETE(request: NextRequest) {
  const user = await getDefaultUser();
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Account id is required." }, { status: 400 });
  }

  const existing = await prisma.account.findFirst({
    where: { id, userId: user.id },
    include: {
      _count: { select: { transactions: true, statements: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (existing._count.transactions > 0 || existing._count.statements > 0) {
    return NextResponse.json(
      {
        error:
          "This account has statements or transactions. Reassign or clear them before removing it.",
      },
      { status: 400 },
    );
  }

  await prisma.category.updateMany({
    where: { userId: user.id, fundingAccountId: id },
    data: { fundingAccountId: null },
  });

  await prisma.account.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
