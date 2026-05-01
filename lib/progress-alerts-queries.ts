import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { buildProgressScopeWhere } from "@/lib/authz-prisma-scopes";
import {
  emptyProgressAlertCounts,
  getAlertCountsByType,
  type ProgressAlertAssessment,
  type ProgressAlertCounts,
  type ProgressAlertViewer,
} from "@/lib/progress-alerts";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import { studentWhereForReportingScope } from "@/lib/progress-v2-reporting-queries";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";
import {
  getStudentIdsWithPendingParentVisibleCoachFeedbackDrafts,
  countDistinctStudentsWithPendingParentVisibleCoachFeedbackDrafts,
} from "@/lib/student-review-attention";
import { overallScoreForDisplay } from "@/lib/progress-assessment-category-scores";
import { progressAssessmentListSelect } from "@/lib/progress-assessment-payload";
import {
  progressAssessmentRecordOperationallyVisible,
  type ProgressAssessmentGuardrailRow,
} from "@/lib/tenant-integrity-guardrails";

function isEmptyStudentScope(where: Prisma.ProgressAssessmentWhereInput): boolean {
  const sid = where.studentId;
  if (
    typeof sid === "object" &&
    sid !== null &&
    "in" in sid &&
    Array.isArray(sid.in) &&
    sid.in.length === 0
  ) {
    return true;
  }
  return false;
}

/**
 * Distinct-student counts per alert type for the same scope as Progress V2 list APIs.
 * Admin / head coach: institute or branch student list; assistant: assigned students only.
 */
export async function getProgressAlertCountsForUser(
  user: SessionUserWithInstitute,
  options?: { now?: Date },
): Promise<ProgressAlertCounts> {
  const now = options?.now ?? new Date();
  if (
    user.role !== ROLE_HEAD_COACH &&
    user.role !== ROLE_ADMIN &&
    user.role !== ROLE_ASSISTANT_COACH
  ) {
    return emptyProgressAlertCounts();
  }

  const baseWhere = await buildProgressScopeWhere(user);
  if (isEmptyStudentScope(baseWhere)) {
    return emptyProgressAlertCounts();
  }

  const studentWhere = await studentWhereForReportingScope(user, baseWhere);

  const [students, rows] = await Promise.all([
    prisma.student.findMany({ where: studentWhere, select: { id: true } }),
    prisma.progressAssessment.findMany({
      where: baseWhere,
      select: {
        ...progressAssessmentListSelect,
      },
    }),
  ]);

  const rowsVisible = rows.filter((r) =>
    progressAssessmentRecordOperationallyVisible(r as ProgressAssessmentGuardrailRow),
  );

  const assessments: ProgressAlertAssessment[] = rowsVisible.map((r) => ({
    studentId: r.studentId,
    status: r.status,
    overallScore: overallScoreForDisplay({
      strengthScore: r.strengthScore,
      flexibilityScore: r.flexibilityScore,
      techniqueScore: r.techniqueScore,
      disciplineScore: r.disciplineScore,
      storedOverallScore: r.overallScore,
    }),
    assessmentDate: r.assessmentDate.toISOString().slice(0, 10),
    createdAt: r.createdAt.toISOString(),
    authorUserId: r.authorUserId,
  }));

  const viewer: ProgressAlertViewer =
    user.role === ROLE_ASSISTANT_COACH
      ? { kind: "assistant", userId: user.id }
      : { kind: "head_coach" };

  const counts = getAlertCountsByType(students, assessments, viewer, { now });

  if (user.role === ROLE_ADMIN) {
    counts.pendingCoachFeedbackDrafts =
      await countDistinctStudentsWithPendingParentVisibleCoachFeedbackDrafts(user.instituteId);
  } else if (user.role === ROLE_HEAD_COACH) {
    const pendingIds = await getStudentIdsWithPendingParentVisibleCoachFeedbackDrafts(
      user.instituteId,
    );
    const inScope = new Set(students.map((s) => s.id));
    counts.pendingCoachFeedbackDrafts = [...pendingIds].filter((id) => inScope.has(id)).length;
  } else if (user.role === ROLE_ASSISTANT_COACH) {
    /** Parity with `GET /api/students?alert=PENDING_COACH_FEEDBACK` (institute drafts ∩ assigned-batch students). */
    const pendingIds = await getStudentIdsWithPendingParentVisibleCoachFeedbackDrafts(
      user.instituteId,
    );
    const inScope = new Set(students.map((s) => s.id));
    counts.pendingCoachFeedbackDrafts = [...pendingIds].filter((id) => inScope.has(id)).length;
    counts.draftProgress = assessments.filter(
      (a) =>
        a.status === PROGRESS_ASSESSMENT_STATUS.DRAFT && a.authorUserId === user.id,
    ).length;
  }

  if (process.env.READ_SCOPE_DEBUG === "1" && user.role === ROLE_ASSISTANT_COACH) {
    console.warn("[read-scope][progress-alerts]", {
      role: user.role,
      instituteId: user.instituteId,
      branchId: user.branchId ?? null,
      pendingCoachFeedbackDrafts: counts.pendingCoachFeedbackDrafts,
      scopedStudentCount: students.length,
      scope: "buildProgressScopeWhere+studentWhereForReportingScope+pendingDrafts∩students",
    });
  }

  return counts;
}
