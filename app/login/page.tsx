import { AuthShell } from "@/components/auth/AuthShell";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell>
      <main className="flex w-full min-w-0 flex-col gap-5 sm:gap-6">
        <BrandHeader />
        <LoginForm />
      </main>
    </AuthShell>
  );
}