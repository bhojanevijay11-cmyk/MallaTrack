import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { progressAssessmentScopeWhere } from "@/lib/progress-assessment-access";
import {
  PROGRESS_ACTIVE_ASSESSMENT_STATUSES,
} from "@/lib/progress-assessment-constants";
import { progressAssessmentListSelect } from "@/lib/progress-assessment-payload";
import {
  progressAssessmentRecordOperationallyVisible,
  type ProgressAssessmentGuardrailRow,
} from "@/lib/tenant-integrity-guardrails";

/**
 * Any progress assessment blocking a new draft cycle (student-level, not per author).
 * Visibility matches GET /api/progress/assessments (scope + operational guardrails).
 * If multiple active rows exist (historical inconsistency), returns the newest by date.
 */
export async function findVisibleActiveProgressAssessmentForStudent(
  user: SessionUserWithInstitute,
  studentId: string,
): Promise<{ id: string; status: string } | null> {
  const scopeWhere = await progressAssessmentScopeWhere(user);
  const rows = await prisma.progressAssessment.findMany({
    where: {
      AND: [
        scopeWhere,
        { studentId },
        { status: { in: [...PROGRESS_ACTIVE_ASSESSMENT_STATUSES] } },
      ],
    },
    orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
    select: progressAssessmentListSelect,
  });

  const visible = rows.filter((r) =>
    progressAssessmentRecordOperationallyVisible(r as ProgressAssessmentGuardrailRow),
  );
  const pick = visible[0];
  return pick ? { id: pick.id, status: pick.status } : null;
}
