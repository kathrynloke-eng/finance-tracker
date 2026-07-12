import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { getCurrentMonthKey } from "@/lib/budget";
import { prisma } from "@/lib/prisma";
import { formatMonthLabel } from "@/lib/format";
import { SectionCard } from "@/components/ui";
import { BudgetEditor } from "@/components/budget-editor";

export default async function BudgetsPage() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const month = getCurrentMonthKey();

  const [categories, budgets] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    prisma.monthlyBudget.findMany({
      where: { userId: user.id, month },
    }),
  ]);

  const initialBudgets = Object.fromEntries(
    budgets.map((budget) => [budget.categoryId, budget.targetAmount]),
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-emerald-700">
          {formatMonthLabel(month)}
        </p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
          Monthly category targets
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Set how much you plan to spend each month, or mark a category as a
          reserve to allocate monthly and only draw when needed.
        </p>
      </div>

      <SectionCard
        title="Set target expenses"
        description="Add custom categories, set monthly spend targets or reserves, then save."
      >
        <BudgetEditor
          month={month}
          categories={categories}
          initialBudgets={initialBudgets}
        />
      </SectionCard>
    </div>
  );
}
