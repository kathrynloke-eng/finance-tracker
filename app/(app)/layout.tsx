import { AppNav } from "@/components/app-nav";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-gradient-to-b from-lime-50/60 via-white to-white">
      <AppNav />
      <main className="mx-auto max-w-6xl px-4 py-5 pb-24 sm:px-6 sm:py-8 lg:pb-8">{children}</main>
    </div>
  );
}
