import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/auth-server";
import { ParentLatestProgressReportSection } from "@/components/parent/ParentLatestProgressReportSection";
import { getParentProgressAssessmentDetail } from "@/lib/parent-dashboard-queries";
import { isAppRole, ROLE_PARENT, roleHomePath } from "@/lib/roles";

export default async function ParentProgressReportPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId: rawAssessmentId } = await params;
  const assessmentId = typeof rawAssessmentId === "string" ? rawAssessmentId.trim() : "";
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/parent/progress/${rawAssessmentId ?? ""}`)}`,
    );
  }

  const role = session.user.role;
  if (!isAppRole(role)) {
    redirect("/login");
  }
  if (role !== ROLE_PARENT) {
    redirect(roleHomePath(role));
  }

  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/parent/progress/${rawAssessmentId ?? ""}`)}`,
    );
  }
  if (user.instituteId === null) {
    redirect("/parent");
  }

  if (!assessmentId) {
    notFound();
  }

  const detail = await getParentProgressAssessmentDetail(
    user.id,
    user.instituteId,
    assessmentId,
  );
  if (!detail) {
    notFound();
  }
  const { report, studentFullName, branchLocationName } = detail;
  const instituteLabel = user.instituteName?.trim() || null;

  return (
    <main className="min-h-dvh bg-[#fafbfc]">
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-5 sm:max-w-2xl sm:px-6 lg:max-w-3xl lg:px-8">
        <Link
          href="/parent"
          className="text-sm font-semibold text-amber-900 underline-offset-2 hover:underline"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">Progress report</h1>
        <p className="mt-1 text-sm text-slate-600">
          Details from your child&apos;s latest approved assessment.
        </p>
        {studentFullName ? (
          <p className="mt-3 text-sm text-slate-800">
            <span className="font-semibold text-slate-600">Student:</span> {studentFullName}
          </p>
        ) : null}
        {instituteLabel ? (
          <p className="mt-1 text-sm text-slate-800">
            <span className="font-semibold text-slate-600">Institute:</span> {instituteLabel}
          </p>
        ) : null}
        {branchLocationName ? (
          <p className="mt-1 text-sm text-slate-800">
            <span className="font-semibold text-slate-600">Branch:</span> {branchLocationName}
          </p>
        ) : null}
        <div className="mt-6">
          <ParentLatestProgressReportSection
            report={report}
            variant="full"
            showViewFullLink={false}
            showSectionHeading={false}
          />
        </div>
      </div>
    </main>
  );
}
