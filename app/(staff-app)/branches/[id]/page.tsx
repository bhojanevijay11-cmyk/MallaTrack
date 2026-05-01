import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { BranchControlCenter } from "@/components/admin/branches/BranchControlCenter";
import { authOptions } from "@/lib/auth";
import { getBranchControlCenterData } from "@/lib/branch-control-center-data";
import { ROLE_ADMIN, roleHomePath } from "@/lib/roles";

type PageProps = { params: Promise<{ id: string }> };

export default async function BranchDetailPage({ params }: PageProps) {
  const { id: branchId } = await params;
  const session = await getServerSession(authOptions);
  const home = roleHomePath(session?.user?.role);

  if (!session?.user) {
    redirect(`/login?callbackUrl=/branches/${encodeURIComponent(branchId)}`);
  }
  if (session.user.role !== ROLE_ADMIN) {
    redirect(home);
  }

  const instituteId = session.user.instituteId ?? null;
  if (instituteId === null) {
    redirect("/onboarding");
  }

  const data = await getBranchControlCenterData(instituteId, branchId);
  if (!data) {
    notFound();
  }

  return (
    <NavPlaceholder
      title={data.branch.name}
      description="Overview, staff roster, and batches for this branch. Detailed batch operations stay on the batch manage page."
      tenantLine={session.user.instituteName?.trim() || null}
      maxWidth="wide"
      dashboardShell
      backHref="/branches"
      backLabel="← Back to branches"
      headerRight={
        <Link
          href="/batches"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          All batches
        </Link>
      }
    >
      <BranchControlCenter
        branch={data.branch}
        headCoachLabels={data.headCoachLabels}
        assistantCoachLabels={data.assistantCoachLabels}
        batches={data.batches}
      />
    </NavPlaceholder>
  );
}
