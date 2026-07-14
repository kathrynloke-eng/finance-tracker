import { ChangePasswordForm } from "@/components/change-password-form";
import { SectionCard } from "@/components/ui";

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-4">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Account security</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Choose your password</h2>
        <p className="mt-2 max-w-xl text-slate-600">If an administrator gave you a temporary password, sign in with it, then replace it here with a password only you know.</p>
      </div>
      <SectionCard title="Change password" description="Your password is securely hashed. The app never stores a readable copy.">
        <ChangePasswordForm />
      </SectionCard>
    </div>
  );
}
