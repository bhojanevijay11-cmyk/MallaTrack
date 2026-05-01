import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { getSessionUser } from "@/lib/auth-server";
import { APP_STAFF_ROLES, roleHomePath } from "@/lib/roles";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?callbackUrl=%2Fonboarding");
  }
  if (!APP_STAFF_ROLES.some((r) => r === user.role)) {
    redirect(roleHomePath(user.role));
  }
  if (user.instituteId !== null) {
    redirect(roleHomePath(user.role));
  }

  return (
    <AuthShell>
      <main className="flex w-full min-w-0 flex-col gap-5 sm:gap-6">
        <BrandHeader />
        <OnboardingForm />
      </main>
    </AuthShell>
  );
}
