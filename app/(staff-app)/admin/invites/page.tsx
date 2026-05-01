import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { deriveInviteListStatus } from "@/lib/invite-status";
import { ROLE_ADMIN } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { AdminInvitesPanel } from "@/components/admin/invites/AdminInvitesPanel";

export default async function AdminInvitesPage() {
  const userRaw = await getSessionUser();
  const admin = await requireRoleWithInstitute(userRaw, [ROLE_ADMIN]);
  if (admin instanceof NextResponse) {
    redirect("/admin");
  }

  const branches = await prisma.branch.findMany({
    where: { instituteId: admin.instituteId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const now = new Date();
  const rows = await prisma.invite.findMany({
    where: { instituteId: admin.instituteId },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      usedAt: true,
      expiresAt: true,
      branch: { select: { name: true } },
    },
  });

  const recentInvites = rows.map((r) => ({
    id: r.id,
    email: r.email,
    fullName: r.fullName,
    role: r.role,
    branchName: r.branch?.name ?? null,
    status: deriveInviteListStatus(r.usedAt, r.expiresAt, now),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <AdminInvitesPanel branches={branches} recentInvites={recentInvites} />
    </main>
  );
}

