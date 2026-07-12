import { formatCurrency } from "@/lib/format";

type BudgetBarProps = {
  name: string;
  icon?: string | null;
  color?: string | null;
  spent: number;
  target: number;
  status: string;
  budgetStyle?: "MONTHLY" | "RESERVE";
  available?: number;
  allocatedTotal?: number;
  spentTotal?: number;
  reserveState?: "healthy" | "low" | "fully_drawn" | "overdrawn";
};

export function BudgetBar({
  name,
  icon,
  color,
  spent,
  target,
  status,
  budgetStyle = "MONTHLY",
  available = 0,
  allocatedTotal = 0,
  spentTotal = 0,
  reserveState,
}: BudgetBarProps) {
  const isReserve = budgetStyle === "RESERVE";
  const percent = isReserve
    ? allocatedTotal > 0
      ? Math.min((spentTotal / allocatedTotal) * 100, 120)
      : 0
    : target > 0
      ? Math.min((spent / target) * 100, 120)
      : 0;
  const barColor = color ?? "#10b981";

  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon ?? "📁"}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-900">{name}</p>
              {isReserve ? (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                  Reserve
                </span>
              ) : null}
            </div>
            <p className="text-sm text-slate-500">
              {isReserve
                ? `${formatCurrency(Math.max(available, 0))} available · drew ${formatCurrency(spent)} this month`
                : `${formatCurrency(spent)}${target > 0 ? ` of ${formatCurrency(target)}` : " spent"}`}
            </p>
            {isReserve && target > 0 ? (
              <p className="text-xs text-slate-400">
                Allocates {formatCurrency(target)}/mo ·{" "}
                {formatCurrency(allocatedTotal)} set aside ·{" "}
                {formatCurrency(spentTotal)} drawn total
              </p>
            ) : null}
          </div>
        </div>
        <StatusBadge
          status={status}
          isReserve={isReserve}
          reserveState={reserveState}
        />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(percent, 100)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  isReserve,
  reserveState,
}: {
  status: string;
  isReserve: boolean;
  reserveState?: "healthy" | "low" | "fully_drawn" | "overdrawn";
}) {
  const styles: Record<string, string> = {
    overspent: "bg-rose-100 text-rose-700",
    warning: "bg-amber-100 text-amber-700",
    on_track: "bg-emerald-100 text-emerald-700",
    no_budget: "bg-slate-100 text-slate-600",
  };

  const labels: Record<string, string> = {
    overspent: isReserve ? "Overdrawn" : "Over budget",
    warning: isReserve
      ? reserveState === "fully_drawn"
        ? "Fully drawn"
        : "Low reserve"
      : "Near limit",
    on_track: isReserve ? "Reserved" : "On track",
    no_budget: isReserve ? "No allocation" : "No target",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? styles.no_budget}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
