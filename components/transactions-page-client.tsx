"use client";

import { useRouter } from "next/navigation";
import { RecurringManager } from "@/components/recurring-manager";
import { TransactionManager } from "@/components/transaction-manager";
import { SectionCard } from "@/components/ui";

type Category = { id: string; name: string };
type Account = { id: string; name: string; type: string };

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  accountId: string;
  recurringTransactionId: string | null;
  category: Category | null;
  account: Account | null;
};

type Recurring = {
  id: string;
  description: string;
  amount: number;
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  startDate: string;
  endDate: string | null;
  nextOccurrence: string;
  isActive: boolean;
  accountId: string;
  categoryId: string | null;
  category: Category | null;
  account: Account | null;
};

type TransactionsPageClientProps = {
  transactions: Transaction[];
  recurring: Recurring[];
  categories: Category[];
  accounts: Account[];
};

export function TransactionsPageClient({
  transactions,
  recurring,
  categories,
  accounts,
}: TransactionsPageClientProps) {
  const router = useRouter();

  return (
    <>
      <SectionCard
        title="Recurring"
        description="Set rent, salary, subscriptions, and other repeating amounts. Due items post into your transaction list automatically."
      >
        <RecurringManager
          recurring={recurring}
          categories={categories}
          accounts={accounts}
          onChanged={() => router.refresh()}
        />
      </SectionCard>

      <SectionCard
        title="Manage activity"
        description="Search, create manual entries, update details, or remove transactions."
      >
        <TransactionManager
          transactions={transactions}
          categories={categories}
          accounts={accounts}
          onChanged={() => router.refresh()}
        />
      </SectionCard>
    </>
  );
}
