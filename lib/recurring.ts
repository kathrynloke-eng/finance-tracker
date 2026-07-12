import { createHash } from "crypto";
import { addMonths, addWeeks, addYears, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { endOfLocalDay, startOfLocalDay } from "@/lib/dates";
import { syncBudgetAlerts, getCurrentMonthKey } from "@/lib/budget";
import { generateTransferSuggestions } from "@/lib/transfers";
import { revalidateFinancePages } from "@/lib/revalidate";

export type RecurrenceFrequency = "WEEKLY" | "MONTHLY" | "YEARLY";

const MAX_GENERATIONS_PER_RULE = 36;

export function advanceOccurrence(
  date: Date,
  frequency: RecurrenceFrequency,
  interval: number,
) {
  const step = Math.max(1, interval);
  if (frequency === "WEEKLY") return addWeeks(date, step);
  if (frequency === "YEARLY") return addYears(date, step);
  return addMonths(date, step);
}

export function buildRecurringDedupeHash(
  recurringId: string,
  occurrenceDate: Date,
) {
  const payload = `recurring|${recurringId}|${format(occurrenceDate, "yyyy-MM-dd")}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function serializeRecurring(rule: {
  id: string;
  description: string;
  amount: number;
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: Date;
  endDate: Date | null;
  nextOccurrence: Date;
  isActive: boolean;
  accountId: string;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  account: { id: string; name: string; type: string } | null;
}) {
  return {
    id: rule.id,
    description: rule.description,
    amount: rule.amount,
    frequency: rule.frequency,
    interval: rule.interval,
    startDate: rule.startDate.toISOString(),
    endDate: rule.endDate ? rule.endDate.toISOString() : null,
    nextOccurrence: rule.nextOccurrence.toISOString(),
    isActive: rule.isActive,
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    category: rule.category
      ? { id: rule.category.id, name: rule.category.name }
      : null,
    account: rule.account
      ? {
          id: rule.account.id,
          name: rule.account.name,
          type: rule.account.type,
        }
      : null,
  };
}

async function refreshMonths(userId: string, dates: Date[]) {
  const months = new Set(dates.map((date) => getCurrentMonthKey(date)));
  for (const month of months) {
    await syncBudgetAlerts(userId, month);
    await generateTransferSuggestions(userId, month);
  }
  revalidateFinancePages();
}

/**
 * Materialize due recurring transactions up through today.
 * Safe to call on page load — skips already-created occurrences via dedupeHash.
 */
export async function materializeDueRecurringTransactions(
  userId: string,
  throughDate = endOfLocalDay(),
) {
  const rules = await prisma.recurringTransaction.findMany({
    where: {
      userId,
      isActive: true,
      nextOccurrence: { lte: throughDate },
    },
  });

  let createdCount = 0;
  const touchedDates: Date[] = [];

  for (const rule of rules) {
    let cursor = startOfLocalDay(rule.nextOccurrence);
    const endDate = rule.endDate ? endOfLocalDay(rule.endDate) : null;
    let generated = 0;

    while (
      cursor.getTime() <= throughDate.getTime() &&
      generated < MAX_GENERATIONS_PER_RULE
    ) {
      if (endDate && cursor.getTime() > endDate.getTime()) {
        await prisma.recurringTransaction.update({
          where: { id: rule.id },
          data: { isActive: false, nextOccurrence: cursor },
        });
        break;
      }

      const dedupeHash = buildRecurringDedupeHash(rule.id, cursor);
      const existing = await prisma.transaction.findFirst({
        where: { userId, dedupeHash },
      });

      if (!existing) {
        try {
          await prisma.transaction.create({
            data: {
              date: cursor,
              description: rule.description,
              amount: rule.amount,
              accountId: rule.accountId,
              categoryId: rule.categoryId,
              userId,
              recurringTransactionId: rule.id,
              status: "CONFIRMED",
              confidence: 1,
              dedupeHash,
            },
          });
          createdCount += 1;
          touchedDates.push(cursor);
          generated += 1;
        } catch (error) {
          // Another request may have materialized this occurrence after the
          // existence check. The unique key makes that outcome safe to ignore.
          if (
            !(
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === "P2002"
            )
          ) {
            throw error;
          }
        }
      }

      cursor = advanceOccurrence(
        cursor,
        rule.frequency as RecurrenceFrequency,
        rule.interval,
      );
    }

    const stillActive =
      !endDate || cursor.getTime() <= endDate.getTime();

    await prisma.recurringTransaction.update({
      where: { id: rule.id },
      data: {
        nextOccurrence: cursor,
        isActive: stillActive,
      },
    });
  }

  if (touchedDates.length > 0) {
    await refreshMonths(userId, touchedDates);
  }

  return { createdCount };
}
