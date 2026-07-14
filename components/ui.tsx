import { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
  compact?: boolean;
};

const toneClasses = {
  default: "border-stone-200 bg-[#fafafa] text-[#1b2a33]",
  success: "border-lime-300 bg-lime-50 text-[#1b2a33]",
  warning: "border-amber-200 bg-amber-50 text-[#1b2a33]",
  danger: "border-rose-200 bg-rose-50 text-[#1b2a33]",
};

export function StatCard({ label, value, hint, tone = "default", compact = false }: StatCardProps) {
  return (
    <div className={`rounded-xl border shadow-sm ${compact ? "p-3 sm:p-5" : "p-5"} ${toneClasses[tone]}`}>
      <p className={`${compact ? "text-xs sm:text-sm" : "text-sm"} font-medium text-slate-500`}>{label}</p>
      <p className={`${compact ? "mt-1 text-lg sm:mt-2 sm:text-3xl" : "mt-2 text-3xl"} font-semibold tracking-tight`}>{value}</p>
      {hint ? <p className={`${compact ? "mt-1 hidden text-sm sm:block sm:mt-2" : "mt-2 text-sm"} text-slate-500`}>{hint}</p> : null}
    </div>
  );
}

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
};

export function SectionCard({ title, description, children, action }: SectionCardProps) {
  return (
    <section className="rounded-xl border border-stone-200 bg-[#fafafa] p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
