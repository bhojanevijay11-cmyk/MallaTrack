import { prisma } from "@/lib/prisma";
import {
  STUDENT_REVIEW_STATUS,
  STUDENT_REVIEW_VISIBILITY,
} from "@/lib/student-review-constants";

/**
 * Students with at least one DRAFT + PARENT_VISIBLE coach review in the institute
 * (unfinished parent-facing feedback). Institute-scoped; intersect with role scope in callers.
 */
export async function getStudentIdsWithPendingParentVisibleCoachFeedbackDrafts(
  instituteId: string,
): Promise<Set<string>> {
  const rows = await prisma.studentReview.findMany({
    where: {
      instituteId,
      status: STUDENT_REVIEW_STATUS.DRAFT,
      visibility: STUDENT_REVIEW_VISIBILITY.PARENT_VISIBLE,
    },
    select: { studentId: true },
  });
  return new Set(rows.map((r) => r.studentId));
}

/** Distinct students matching {@link getStudentIdsWithPendingParentVisibleCoachFeedbackDrafts}. */
export async function countDistinctStudentsWithPendingParentVisibleCoachFeedbackDrafts(
  instituteId: string,
): Promise<number> {
  const ids = await getStudentIdsWithPendingParentVisibleCoachFeedbackDrafts(instituteId);
  return ids.size;
}
