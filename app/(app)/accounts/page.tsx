import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { getFundingPlan } from "@/lib/funding";
import { getCurrentMonthKey } from "@/lib/budget";
import { prisma } from "@/lib/prisma";
import { formatMonthLabel } from "@/lib/format";
import { AccountsManager } from "@/components/accounts-manager";

export default async function AccountsPage() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const month = getCurrentMonthKey();

  const [accounts, categories, plan] = await Promise.all([
    prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    getFundingPlan(user.id, month),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-emerald-700">
          {formatMonthLabel(month)}
        </p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
          Accounts & transfers
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Set up your bank accounts, map expense categories to the account that
          should cover them, then save to update transfer balances.
        </p>
      </div>

      <AccountsManager
        initialAccounts={accounts}
        initialCategories={categories}
        initialPlan={plan}
      />
    </div>
  );
}
