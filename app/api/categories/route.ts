import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { getCurrentMonthKey, syncBudgetAlerts } from "@/lib/budget";
import { generateTransferSuggestions } from "@/lib/transfers";
import { revalidateFinancePages } from "@/lib/revalidate";

const PROTECTED_NAMES = new Set(["Income", "Transfer", "Uncategorized"]);

const COLOR_PALETTE = [
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
  "#6366f1",
  "#0ea5e9",
];

function normalizeName(name: unknown) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 40) return null;
  return trimmed;
}

export async function GET() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const body = await request.json();
  const name = normalizeName(body.name);

  if (!name) {
    return NextResponse.json(
      { error: "Category name must be 2–40 characters." },
      { status: 400 },
    );
  }

  if (PROTECTED_NAMES.has(name)) {
    return NextResponse.json(
      { error: "That category name is reserved." },
      { status: 400 },
    );
  }

  const existing = await prisma.category.findFirst({
    where: {
      userId: user.id,
      name: { equals: name },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A category with that name already exists." },
      { status: 409 },
    );
  }

  const count = await prisma.category.count({ where: { userId: user.id } });
  const color =
    typeof body.color === "string" && body.color
      ? body.color
      : COLOR_PALETTE[count % COLOR_PALETTE.length];
  const icon =
    typeof body.icon === "string" && body.icon.trim()
      ? Array.from(body.icon.trim()).slice(0, 2).join("") || "📁"
      : "📁";

  const category = await prisma.category.create({
    data: {
      name,
      icon,
      color,
      userId: user.id,
      isDefault: false,
      budgetStyle:
        body.budgetStyle === "RESERVE" ? "RESERVE" : "MONTHLY",
    },
  });

  return NextResponse.json({ category }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getDefaultUser();
  const body = await request.json();
  const { id } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Category id is required." }, { status: 400 });
  }

  const existing = await prisma.category.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  if (PROTECTED_NAMES.has(existing.name) && body.fundingAccountId === undefined) {
    return NextResponse.json(
      { error: "System categories cannot be renamed." },
      { status: 400 },
    );
  }

  if (PROTECTED_NAMES.has(existing.name) && body.fundingAccountId !== undefined) {
    return NextResponse.json(
      { error: "System categories cannot be mapped to bank accounts." },
      { status: 400 },
    );
  }

  const data: {
    name?: string;
    icon?: string;
    color?: string;
    fundingAccountId?: string | null;
    budgetStyle?: "MONTHLY" | "RESERVE";
  } = {};

  if (body.budgetStyle !== undefined) {
    if (body.budgetStyle !== "MONTHLY" && body.budgetStyle !== "RESERVE") {
      return NextResponse.json(
        { error: "budgetStyle must be MONTHLY or RESERVE." },
        { status: 400 },
      );
    }
    if (PROTECTED_NAMES.has(existing.name)) {
      return NextResponse.json(
        { error: "System categories cannot change budget style." },
        { status: 400 },
      );
    }
    data.budgetStyle = body.budgetStyle;
  }

  if (body.fundingAccountId !== undefined) {
    if (body.fundingAccountId === null || body.fundingAccountId === "") {
      data.fundingAccountId = null;
    } else if (typeof body.fundingAccountId === "string") {
      const account = await prisma.account.findFirst({
        where: { id: body.fundingAccountId, userId: user.id },
      });
      if (!account) {
        return NextResponse.json({ error: "Account not found." }, { status: 404 });
      }
      data.fundingAccountId = account.id;
    } else {
      return NextResponse.json(
        { error: "fundingAccountId must be a string or null." },
        { status: 400 },
      );
    }
  }

  if (body.name !== undefined) {
    if (PROTECTED_NAMES.has(existing.name)) {
      return NextResponse.json(
        { error: "System categories cannot be renamed." },
        { status: 400 },
      );
    }
    const name = normalizeName(body.name);
    if (!name) {
      return NextResponse.json(
        { error: "Category name must be 2–40 characters." },
        { status: 400 },
      );
    }
    if (PROTECTED_NAMES.has(name)) {
      return NextResponse.json(
        { error: "That category name is reserved." },
        { status: 400 },
      );
    }

    const duplicate = await prisma.category.findFirst({
      where: {
        userId: user.id,
        name: { equals: name },
        NOT: { id },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "A category with that name already exists." },
        { status: 409 },
      );
    }

    data.name = name;
  }

  if (typeof body.icon === "string" && body.icon.trim()) {
    data.icon =
      Array.from(body.icon.trim()).slice(0, 2).join("") ||
      existing.icon ||
      "📁";
  }

  if (typeof body.color === "string" && body.color.trim()) {
    data.color = body.color.trim();
  }

  const category = await prisma.category.update({
    where: { id },
    data,
  });

  if (
    data.budgetStyle !== undefined ||
    data.fundingAccountId !== undefined
  ) {
    const month = getCurrentMonthKey();
    await syncBudgetAlerts(user.id, month);
    await generateTransferSuggestions(user.id, month);
  }

  revalidateFinancePages();

  return NextResponse.json({ category });
}

export async function DELETE(request: NextRequest) {
  const user = await getDefaultUser();
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Category id is required." }, { status: 400 });
  }

  const existing = await prisma.category.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  if (PROTECTED_NAMES.has(existing.name)) {
    return NextResponse.json(
      {
        error:
          "Income, Transfer, and Uncategorized are required and cannot be deleted.",
      },
      { status: 400 },
    );
  }

  const uncategorized = await prisma.category.findFirst({
    where: { userId: user.id, name: "Uncategorized" },
  });

  if (uncategorized) {
    await prisma.transaction.updateMany({
      where: { userId: user.id, categoryId: id },
      data: { categoryId: uncategorized.id },
    });
  }

  await prisma.alert.updateMany({
    where: { userId: user.id, categoryId: id },
    data: { categoryId: null },
  });

  await prisma.monthlyBudget.deleteMany({
    where: { userId: user.id, categoryId: id },
  });

  await prisma.categorizationRule.deleteMany({
    where: { userId: user.id, categoryId: id },
  });

  await prisma.category.delete({ where: { id } });

  const month = getCurrentMonthKey();
  await syncBudgetAlerts(user.id, month);
  await generateTransferSuggestions(user.id, month);
  revalidateFinancePages();

  return NextResponse.json({ ok: true });
}
