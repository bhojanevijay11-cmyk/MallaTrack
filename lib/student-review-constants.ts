/** Stored on StudentReview.visibility */
export const STUDENT_REVIEW_VISIBILITY = {
  INTERNAL: "INTERNAL",
  PARENT_VISIBLE: "PARENT_VISIBLE",
} as const;

export type StudentReviewVisibility =
  (typeof STUDENT_REVIEW_VISIBILITY)[keyof typeof STUDENT_REVIEW_VISIBILITY];

/** Stored on StudentReview.status */
export const STUDENT_REVIEW_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

export type StudentReviewStatus =
  (typeof STUDENT_REVIEW_STATUS)[keyof typeof STUDENT_REVIEW_STATUS];

export function parseStudentReviewVisibility(
  v: unknown,
): StudentReviewVisibility | null {
  if (v === STUDENT_REVIEW_VISIBILITY.INTERNAL) return v;
  if (v === STUDENT_REVIEW_VISIBILITY.PARENT_VISIBLE) return v;
  return null;
}

export function parseStudentReviewStatus(v: unknown): StudentReviewStatus | null {
  if (v === STUDENT_REVIEW_STATUS.DRAFT) return v;
  if (v === STUDENT_REVIEW_STATUS.PUBLISHED) return v;
  return null;
}
