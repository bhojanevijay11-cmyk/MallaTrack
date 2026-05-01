import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashInviteToken } from "@/lib/invites";
import { AuthShell } from "@/components/auth/AuthShell";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { ParentAcceptInviteForm } from "@/components/parent/ParentAcceptInviteForm";
import { ROLE_PARENT } from "@/lib/roles";

export default async function ParentAcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.token;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    redirect("/login");
  }

  const tokenHash = hashInviteToken(token);
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    select: {
      email: true,
      usedAt: true,
      expiresAt: true,
      studentId: true,
      role: true,
    },
  });

  if (!invite || !invite.studentId || invite.role !== ROLE_PARENT) {
    redirect("/login");
  }

  const now = new Date();
  const expired = invite.expiresAt <= now;
  const used = invite.usedAt !== null;

  return (
    <AuthShell>
      <main className="flex w-full min-w-0 flex-col gap-5 sm:gap-6">
        <BrandHeader />
        <ParentAcceptInviteForm
          token={token}
          email={invite.email}
          expired={expired}
          used={used}
        />
      </main>
    </AuthShell>
  );
}
