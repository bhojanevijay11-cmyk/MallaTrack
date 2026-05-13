import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { branchLocationDisplayLabel } from "@/lib/branch-display-label";
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

  const [institute, branchRows, rows, now] = await Promise.all([
    prisma.institute.findUnique({
      where: { id: admin.instituteId },
      select: { name: true },
    }),
    prisma.branch.findMany({
      where: { instituteId: admin.instituteId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.invite.findMany({
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
    }),
    Promise.resolve(new Date()),
  ]);

  const instituteName = institute?.name?.trim() || null;

  const branches = branchRows.map((b) => ({
    id: b.id,
    name: branchLocationDisplayLabel(instituteName, b.name) ?? b.name.trim(),
  }));

  const recentInvites = rows.map((r) => ({
    id: r.id,
    email: r.email,
    fullName: r.fullName,
    role: r.role,
    branchName: r.branch?.name
      ? branchLocationDisplayLabel(instituteName, r.branch.name) ?? r.branch.name.trim()
      : null,
    status: deriveInviteListStatus(r.usedAt, r.expiresAt, now),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <AdminInvitesPanel branches={branches} recentInvites={recentInvites} />
    </main>
  );
}

