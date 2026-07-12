import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { parseDateInput, startOfLocalDay } from "@/lib/dates";
import {
  materializeDueRecurringTransactions,
  serializeRecurring,
  type RecurrenceFrequency,
} from "@/lib/recurring";
import { revalidateFinancePages } from "@/lib/revalidate";

const FREQUENCIES = new Set<RecurrenceFrequency>([
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);

function parseAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return amount;
}

function parseFrequency(value: unknown): RecurrenceFrequency | null {
  if (typeof value !== "string") return null;
  const frequency = value.toUpperCase() as RecurrenceFrequency;
  return FREQUENCIES.has(frequency) ? frequency : null;
}

function parseInterval(value: unknown) {
  const interval =
    typeof value === "number" ? value : Number(value ?? 1);
  if (!Number.isInteger(interval) || interval < 1 || interval > 52) {
    return null;
  }
  return interval;
}

async function includeRelations() {
  return {
    category: true,
    account: true,
  } as const;
}

export async function GET() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);
  await materializeDueRecurringTransactions(user.id);
  revalidateFinancePages();

  const rules = await prisma.recurringTransaction.findMany({
    where: { userId: user.id },
    include: await includeRelations(),
    orderBy: [{ isActive: "desc" }, { nextOccurrence: "asc" }],
  });

  return NextResponse.json({
    recurring: rules.map((rule) =>
      serializeRecurring({
        ...rule,
        frequency: rule.frequency as RecurrenceFrequency,
      }),
    ),
  });
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
  const frequency = parseFrequency(body.frequency);
  const interval = parseInterval(body.interval);
  const startDate = parseDateInput(body.startDate);
  const endDate =
    body.endDate === null || body.endDate === ""
      ? null
      : parseDateInput(body.endDate);
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
  if (!frequency) {
    return NextResponse.json(
      { error: "Choose weekly, monthly, or yearly." },
      { status: 400 },
    );
  }
  if (interval === null) {
    return NextResponse.json(
      { error: "Interval must be a whole number between 1 and 52." },
      { status: 400 },
    );
  }
  if (!startDate) {
    return NextResponse.json(
      { error: "Enter a valid start date." },
      { status: 400 },
    );
  }
  if (body.endDate && !endDate) {
    return NextResponse.json(
      { error: "Enter a valid end date, or leave it blank." },
      { status: 400 },
    );
  }
  if (endDate && endDate.getTime() < startDate.getTime()) {
    return NextResponse.json(
      { error: "End date must be on or after the start date." },
      { status: 400 },
    );
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

  const rule = await prisma.recurringTransaction.create({
    data: {
      description,
      amount,
      frequency,
      interval,
      startDate,
      endDate,
      nextOccurrence: startDate,
      isActive: true,
      accountId: account.id,
      categoryId,
      userId: user.id,
    },
    include: await includeRelations(),
  });

  const { createdCount } = await materializeDueRecurringTransactions(user.id);
  revalidateFinancePages();

  const refreshed = await prisma.recurringTransaction.findUnique({
    where: { id: rule.id },
    include: await includeRelations(),
  });

  return NextResponse.json(
    {
      recurring: serializeRecurring({
        ...(refreshed ?? rule),
        frequency: (refreshed ?? rule).frequency as RecurrenceFrequency,
      }),
      createdCount,
    },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const user = await getDefaultUser();
  const body = await request.json();
  const { id } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "Recurring transaction id is required." },
      { status: 400 },
    );
  }

  const existing = await prisma.recurringTransaction.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Recurring transaction not found." },
      { status: 404 },
    );
  }

  const data: {
    description?: string;
    amount?: number;
    frequency?: RecurrenceFrequency;
    interval?: number;
    startDate?: Date;
    endDate?: Date | null;
    nextOccurrence?: Date;
    isActive?: boolean;
    accountId?: string;
    categoryId?: string | null;
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

  if (body.frequency !== undefined) {
    const frequency = parseFrequency(body.frequency);
    if (!frequency) {
      return NextResponse.json(
        { error: "Choose weekly, monthly, or yearly." },
        { status: 400 },
      );
    }
    data.frequency = frequency;
  }

  if (body.interval !== undefined) {
    const interval = parseInterval(body.interval);
    if (interval === null) {
      return NextResponse.json(
        { error: "Interval must be a whole number between 1 and 52." },
        { status: 400 },
      );
    }
    data.interval = interval;
  }

  if (body.startDate !== undefined) {
    const startDate = parseDateInput(body.startDate);
    if (!startDate) {
      return NextResponse.json(
        { error: "Enter a valid start date." },
        { status: 400 },
      );
    }
    data.startDate = startDate;
  }

  if (body.endDate !== undefined) {
    if (body.endDate === null || body.endDate === "") {
      data.endDate = null;
    } else {
      const endDate = parseDateInput(body.endDate);
      if (!endDate) {
        return NextResponse.json(
          { error: "Enter a valid end date, or leave it blank." },
          { status: 400 },
        );
      }
      data.endDate = endDate;
    }
  }

  if (body.nextOccurrence !== undefined) {
    const nextOccurrence = parseDateInput(body.nextOccurrence);
    if (!nextOccurrence) {
      return NextResponse.json(
        { error: "Enter a valid next occurrence date." },
        { status: 400 },
      );
    }
    data.nextOccurrence = nextOccurrence;
  }

  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
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

  const start = data.startDate ?? existing.startDate;
  const end = data.endDate !== undefined ? data.endDate : existing.endDate;
  if (end && end.getTime() < start.getTime()) {
    return NextResponse.json(
      { error: "End date must be on or after the start date." },
      { status: 400 },
    );
  }

  // When the schedule changes, rebase nextOccurrence on the (possibly new)
  // start date unless the client explicitly set nextOccurrence.
  const scheduleChanged =
    data.startDate !== undefined ||
    data.frequency !== undefined ||
    data.interval !== undefined;
  if (scheduleChanged && body.nextOccurrence === undefined) {
    data.nextOccurrence = startOfLocalDay(start);
  }

  await prisma.recurringTransaction.update({
    where: { id },
    data,
  });

  if (data.isActive !== false) {
    await materializeDueRecurringTransactions(user.id);
  }
  revalidateFinancePages();

  const refreshed = await prisma.recurringTransaction.findUnique({
    where: { id },
    include: await includeRelations(),
  });

  if (!refreshed) {
    return NextResponse.json(
      { error: "Recurring transaction not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    recurring: serializeRecurring({
      ...refreshed,
      frequency: refreshed.frequency as RecurrenceFrequency,
    }),
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getDefaultUser();
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Provide a recurring transaction id." },
      { status: 400 },
    );
  }

  const existing = await prisma.recurringTransaction.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Recurring transaction not found." },
      { status: 404 },
    );
  }

  await prisma.recurringTransaction.delete({ where: { id } });
  revalidateFinancePages();

  return NextResponse.json({ ok: true });
}
