import { AuthShell } from "@/components/auth/AuthShell";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { ResetPasswordView } from "@/components/auth/ResetPasswordView";
import { prisma } from "@/lib/prisma";
import { hashPasswordResetToken } from "@/lib/password-reset";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.token;
  const tokenRaw = Array.isArray(raw) ? raw[0] : raw;
  const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";

  let mode: "invalid" | "form" = "invalid";
  let formToken = "";

  if (token) {
    const tokenHash = hashPasswordResetToken(token);
    const user = await prisma.user.findUnique({
      where: { passwordResetTokenHash: tokenHash },
      select: { passwordResetExpires: true },
    });
    const now = Date.now();
    if (
      user?.passwordResetExpires &&
      user.passwordResetExpires.getTime() >= now
    ) {
      mode = "form";
      formToken = token;
    }
  }

  return (
    <AuthShell>
      <main className="flex w-full min-w-0 flex-col gap-5 sm:gap-6">
        <BrandHeader />
        {mode === "form" ? (
          <ResetPasswordView mode="form" token={formToken} />
        ) : (
          <ResetPasswordView mode="invalid" />
        )}
      </main>
    </AuthShell>
  );
}
