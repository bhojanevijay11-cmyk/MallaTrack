import { getServerSession } from "next-auth/next";
import { HeadCoachDashboard } from "@/components/head-coach/HeadCoachDashboard";
import { authOptions } from "@/lib/auth";
import { getHeadCoachDashboardSnapshot } from "@/lib/head-coach-branch-data";
import type { HeadCoachDashboardSnapshot } from "@/lib/head-coach-branch-data";
import {
  branchScopeAuditEnabled,
  getBranchScopeConsistencyCounts,
  logHeadCoachBranchAudit,
  logStudentBatchBranchAudit,
} from "@/lib/branch-scope-audit";
import { ROLE_HEAD_COACH } from "@/lib/roles";

export default async function HeadCoachHomePage() {
  const session = await getServerSession(authOptions);
  const branchId = session?.user?.branchId ?? null;
  const instituteId = session?.user?.instituteId ?? null;
  const isHeadCoach = session?.user?.role === ROLE_HEAD_COACH;

  let initialSnapshot: HeadCoachDashboardSnapshot | null = null;
  const userId = session?.user?.id?.trim() ?? "";
  if (isHeadCoach && instituteId && userId) {
    initialSnapshot = await getHeadCoachDashboardSnapshot(branchId, instituteId, {
      userId,
    });
  }

  if (branchScopeAuditEnabled() && isHeadCoach && instituteId && userId) {
    try {
      const enrolledStudents = initialSnapshot?.summary.enrolledStudents ?? 0;
      logHeadCoachBranchAudit({
        source: "page/head-coach",
        phase: "ssr",
        userId,
        instituteId,
        branchId,
        enrolledStudents,
      });
      if (enrolledStudents === 0) {
        const consistency = await getBranchScopeConsistencyCounts(instituteId, branchId);
        logStudentBatchBranchAudit({
          source: "page/head-coach",
          phase: "zero_enrolled_followup",
          userId,
          instituteId,
          headCoachBranchId: branchId,
          hasStudentsOnNullBranchBatches: consistency.studentsOnNullBranchBatches > 0,
          studentsOnNullBranchBatches: consistency.studentsOnNullBranchBatches,
          consistency,
        });
      }
    } catch (e) {
      logHeadCoachBranchAudit({
        source: "page/head-coach",
        phase: "audit_error",
        message: String(e),
      });
    }
  }

  const displayName =
    session?.user?.name?.split("@")[0] ??
    session?.user?.email?.split("@")[0] ??
    "Coach";

  const instituteName = session?.user?.instituteName ?? null;

  return (
    <HeadCoachDashboard
      initialSnapshot={initialSnapshot}
      displayName={displayName}
      instituteName={instituteName}
    />
  );
}
