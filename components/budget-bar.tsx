import { formatCurrency } from "@/lib/format";

type BudgetBarProps = {
  name: string;
  icon?: string | null;
  color?: string | null;
  spent: number;
  target: number;
  status: string;
};

export function BudgetBar({
  name,
  icon,
  color,
  spent,
  target,
  status,
}: BudgetBarProps) {
  const percent = target > 0 ? Math.min((spent / target) * 100, 120) : 0;
  const barColor = color ?? "#10b981";

  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon ?? "📁"}</span>
          <div>
            <p className="font-medium text-slate-900">{name}</p>
            <p className="text-sm text-slate-500">
              {formatCurrency(spent)}
              {target > 0 ? ` of ${formatCurrency(target)}` : " spent"}
            </p>
          </div>
        </div>
        <StatusBadge status={status} />
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    overspent: "bg-rose-100 text-rose-700",
    warning: "bg-amber-100 text-amber-700",
    on_track: "bg-emerald-100 text-emerald-700",
    no_budget: "bg-slate-100 text-slate-600",
  };

  const labels: Record<string, string> = {
    overspent: "Over budget",
    warning: "Near limit",
    on_track: "On track",
    no_budget: "No target",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? styles.no_budget}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
