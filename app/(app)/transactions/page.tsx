import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/ui";
import { TransactionReview } from "@/components/transaction-review";

export default async function TransactionsPage() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const [transactions, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedTransactions = transactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date.toISOString(),
    description: transaction.description,
    amount: transaction.amount,
    status: transaction.status,
    category: transaction.category,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
          Transactions
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Review imported transactions and fix categories. The app learns from your
          corrections for future statement uploads.
        </p>
      </div>

      <SectionCard
        title="Imported activity"
        description="Low-confidence matches are marked for review."
      >
        <TransactionReview
          transactions={serializedTransactions}
          categories={categories}
        />
      </SectionCard>
    </div>
  );
}
