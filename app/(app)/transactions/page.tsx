import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { materializeDueRecurringTransactions } from "@/lib/recurring";
import { serializeRecurring } from "@/lib/recurring";
import type { RecurrenceFrequency } from "@/lib/recurring";
import { TransactionsPageClient } from "@/components/transactions-page-client";

export default async function TransactionsPage() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);
  await materializeDueRecurringTransactions(user.id);

  const [transactions, categories, accounts, recurring] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id },
      include: { category: true, account: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    prisma.recurringTransaction.findMany({
      where: { userId: user.id },
      include: { category: true, account: true },
      orderBy: [{ isActive: "desc" }, { nextOccurrence: "asc" }],
    }),
  ]);

  const serializedCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));
  const serializedAccounts = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
          Transactions
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Add, edit, or delete transactions. Set recurring templates for rent,
          salary, and subscriptions — due items post automatically.
        </p>
      </div>

      <TransactionsPageClient
        transactions={transactions.map((transaction) => ({
          id: transaction.id,
          date: transaction.date.toISOString(),
          description: transaction.description,
          amount: transaction.amount,
          status: transaction.status,
          accountId: transaction.accountId,
          recurringTransactionId: transaction.recurringTransactionId,
          category: transaction.category
            ? { id: transaction.category.id, name: transaction.category.name }
            : null,
          account: transaction.account
            ? {
                id: transaction.account.id,
                name: transaction.account.name,
                type: transaction.account.type,
              }
            : null,
        }))}
        recurring={recurring.map((rule) =>
          serializeRecurring({
            ...rule,
            frequency: rule.frequency as RecurrenceFrequency,
          }),
        )}
        categories={serializedCategories}
        accounts={serializedAccounts}
      />
    </div>
  );
}
