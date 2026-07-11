import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/ui";
import { UploadForm } from "@/components/upload-form";

export default async function UploadPage() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });

  const recentStatements = await prisma.statement.findMany({
    where: { userId: user.id },
    include: { account: true },
    orderBy: { uploadedAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
          Upload PDF statement
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Start with text-based PDF exports from your bank or credit card. The app
          extracts transactions, assigns categories, and updates your monthly dashboard.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Import a statement"
          description="Choose the account and upload a monthly PDF."
        >
          <UploadForm accounts={accounts} />
        </SectionCard>

        <SectionCard
          title="Recent uploads"
          description="Latest statement processing results."
        >
          {recentStatements.length === 0 ? (
            <p className="text-sm text-slate-500">No statements uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentStatements.map((statement) => (
                <li
                  key={statement.id}
                  className="rounded-xl border border-slate-100 px-4 py-3 text-sm"
                >
                  <p className="font-medium text-slate-900">{statement.fileName}</p>
                  <p className="mt-1 text-slate-500">
                    {statement.account.name} ·{" "}
                    <span
                      className={
                        statement.status === "PARSED"
                          ? "text-emerald-700"
                          : statement.status === "FAILED"
                            ? "text-rose-700"
                            : "text-amber-700"
                      }
                    >
                      {statement.status.toLowerCase()}
                    </span>
                  </p>
                  {statement.errorMessage ? (
                    <p className="mt-2 text-rose-600">{statement.errorMessage}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
