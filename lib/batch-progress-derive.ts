import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";

export type BatchProgressViewer = { kind: "assistant"; userId: string } | { kind: "readonly" };

export type DerivedBatchStudentProgress = {
  latestApproved: ProgressAssessmentListItem | null;
  hasPendingReview: boolean;
  needsRevisionHighlight: boolean;
  /** Assessment to open in detail (readonly): newest in full batch scope for student. */
  readonlyClickTarget: ProgressAssessmentListItem | null;
  /** Newest assessment in assistant's scope for student (for edit/new flow). */
  assistantNewestOwned: ProgressAssessmentListItem | null;
};

function sortNewestFirst(rows: ProgressAssessmentListItem[]): ProgressAssessmentListItem[] {
  return [...rows].sort((a, b) => {
    const byDate = b.assessmentDate.localeCompare(a.assessmentDate);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Derives per-student progress summary from GET /api/progress/assessments?batchId=… (already scoped).
 */
export function deriveBatchStudentProgress(
  batchAssessments: ProgressAssessmentListItem[],
  studentId: string,
  viewer: BatchProgressViewer,
): DerivedBatchStudentProgress {
  const forStudent = batchAssessments.filter((a) => a.studentId === studentId);
  const allSorted = sortNewestFirst(forStudent);

  const owned =
    viewer.kind === "assistant"
      ? forStudent.filter((a) => a.authorUserId === viewer.userId)
      : forStudent;
  const ownedSorted = sortNewestFirst(owned);

  const latestApproved =
    viewer.kind === "assistant"
      ? ownedSorted.find((a) => a.status === PROGRESS_ASSESSMENT_STATUS.APPROVED) ?? null
      : allSorted.find((a) => a.status === PROGRESS_ASSESSMENT_STATUS.APPROVED) ?? null;

  const hasPendingReview =
    viewer.kind === "assistant"
      ? owned.some((a) => a.status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW)
      : forStudent.some((a) => a.status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW);

  const topForHighlight =
    viewer.kind === "assistant" ? ownedSorted[0] ?? null : allSorted[0] ?? null;
  const needsRevisionHighlight =
    topForHighlight?.status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION;

  return {
    latestApproved,
    hasPendingReview,
    needsRevisionHighlight,
    readonlyClickTarget: allSorted[0] ?? null,
    assistantNewestOwned: ownedSorted[0] ?? null,
  };
}
