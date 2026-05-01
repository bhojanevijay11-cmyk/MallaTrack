import { AuthShell } from "@/components/auth/AuthShell";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <main className="flex w-full min-w-0 flex-col gap-5 sm:gap-6">
        <BrandHeader />
        <ForgotPasswordForm />
      </main>
    </AuthShell>
  );
}
