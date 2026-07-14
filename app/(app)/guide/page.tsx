import Link from "next/link";
import { SectionCard } from "@/components/ui";

const steps = [
  {
    number: "01",
    title: "Set up your accounts",
    description:
      "Add the accounts you use for everyday spending, savings, and credit cards. Keep account names general if you prefer less identifying information in the app.",
    href: "/accounts",
    action: "Manage accounts",
  },
  {
    number: "02",
    title: "Create monthly budgets and reserves",
    description:
      "Create spending categories and give each a monthly target. Use the Reserve type for money you want to set aside for a future expense or goal.",
    href: "/budgets",
    action: "Set budgets",
  },
  {
    number: "03",
    title: "Add your spending",
    description:
      "Add transactions manually, or import a statement. Uploaded files are parsed for transactions and are not kept as raw files after processing.",
    href: "/upload",
    action: "Import a statement",
  },
  {
    number: "04",
    title: "Check and categorise transactions",
    description:
      "Review imported transactions, confirm the right category, and correct anything that does not look right. Accurate categories make every dashboard view more useful.",
    href: "/transactions",
    action: "Review transactions",
  },
  {
    number: "05",
    title: "Plan your income",
    description:
      "Use the Plan page to allocate monthly income across essentials, lifestyle, savings, investments, debt repayment, giving, and other priorities.",
    href: "/allocation",
    action: "Open your plan",
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-8 pb-4">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl shadow-emerald-950/15 sm:px-8 sm:py-10">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lime-300/25 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="text-sm font-semibold text-lime-200">Getting started</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">A simple rhythm for your money.</h2>
          <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">
            Start with the essentials below, then return each month to review spending, reserves, and progress toward the things that matter to you.
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <SectionCard title="Your first month" description="Follow these steps in order, or jump to the part you need.">
          <ol className="space-y-3">
            {steps.map((step) => (
              <li key={step.number} className="flex gap-4 rounded-xl border border-stone-200 bg-white p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-100 text-xs font-bold text-slate-800">
                  {step.number}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                  <Link href={step.href} className="mt-3 inline-block text-sm font-semibold text-slate-800 underline decoration-lime-300 decoration-2 underline-offset-4 hover:text-slate-950">
                    {step.action} →
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="How to use the dashboard" description="Your monthly home screen at a glance.">
            <ul className="space-y-3 text-sm leading-6 text-slate-600">
              <li><span className="font-semibold text-slate-900">View month:</span> choose an earlier month to review your history.</li>
              <li><span className="font-semibold text-slate-900">Budget health:</span> compares everyday spending with your monthly targets.</li>
              <li><span className="font-semibold text-slate-900">Reserve:</span> tracks money set aside separately from regular spending.</li>
              <li><span className="font-semibold text-slate-900">Spending by category:</span> helps you spot where your money is going.</li>
            </ul>
            <Link href="/" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
              Go to dashboard
            </Link>
          </SectionCard>

          <SectionCard title="Privacy reminder" description="A few good habits for shared use.">
            <p className="text-sm leading-6 text-slate-600">
              Each person sees only their own data. Do not share your password, and sign out when using a shared computer. The app keeps imported transaction data, but deletes the raw statement file after parsing.
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
