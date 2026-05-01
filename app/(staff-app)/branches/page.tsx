import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { BranchManagementPanel } from "@/components/admin/branches/BranchManagementPanel";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_ADMIN, roleHomePath } from "@/lib/roles";

export default async function BranchesPage() {
  const session = await getServerSession(authOptions);
  const home = roleHomePath(session?.user?.role);

  if (!session?.user) {
    redirect("/login?callbackUrl=/branches");
  }
  if (session.user.role !== ROLE_ADMIN) {
    redirect(home);
  }

  const instituteId = session.user.instituteId ?? null;
  if (instituteId === null) {
    redirect("/onboarding");
  }

  const branches = await prisma.branch.findMany({
    where: { instituteId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, createdAt: true },
  });

  const rows = branches.map((b) => ({
    id: b.id,
    name: b.name,
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <NavPlaceholder
      title="Branch Management"
      description="Define branches, then open each control center to see batches, staff, and jump into batch management."
      tenantLine={session.user.instituteName?.trim() || null}
      maxWidth="wide"
      dashboardShell
      showBackLink={false}
    >
      <BranchManagementPanel initialBranches={rows} />
    </NavPlaceholder>
  );
}
