import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashInviteToken } from "@/lib/invites";
import { AuthShell } from "@/components/auth/AuthShell";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { InviteAcceptForm } from "@/components/invites/InviteAcceptForm";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashInviteToken(token);
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      usedAt: true,
      expiresAt: true,
      studentId: true,
    },
  });

  if (!invite) {
    redirect("/login");
  }
  if (invite.studentId) {
    redirect(`/parent/accept-invite?token=${encodeURIComponent(token)}`);
  }
  const now = new Date();
  const expired = invite.expiresAt <= now;
  const used = invite.usedAt !== null;

  return (
    <AuthShell>
      <main className="flex w-full min-w-0 flex-col gap-5 sm:gap-6">
        <BrandHeader />
        <InviteAcceptForm
          token={token}
          fullName={invite.fullName}
          email={invite.email}
          role={invite.role}
          expired={expired}
          used={used}
        />
      </main>
    </AuthShell>
  );
}

