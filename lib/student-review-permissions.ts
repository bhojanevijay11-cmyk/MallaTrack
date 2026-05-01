import type { SessionScopeUser } from "@/lib/auth-types";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
} from "@/lib/roles";
import { canAccessStudent } from "@/lib/scope";
import {
  STUDENT_REVIEW_STATUS,
  type StudentReviewStatus,
} from "@/lib/student-review-constants";

type ReviewScopeRow = {
  studentId: string;
  instituteId: string;
  authorUserId: string;
  status: string;
};

/** Who may set status to PUBLISHED (or change publish state). */
export function canPublishStudentReview(user: SessionScopeUser): boolean {
  return user.role === ROLE_HEAD_COACH || user.role === ROLE_ADMIN;
}

/**
 * Whether the user may edit review content or metadata (excluding publish — use rules in route).
 * Assistant: own drafts only. Head/Admin: any review for a student they can access.
 */
export async function canEditStudentReview(
  user: SessionScopeUser,
  review: ReviewScopeRow,
): Promise<boolean> {
  if (user.instituteId !== review.instituteId) return false;

  if (user.role === ROLE_ADMIN) {
    return canAccessStudent(user, review.studentId);
  }
  if (user.role === ROLE_HEAD_COACH) {
    return canAccessStudent(user, review.studentId);
  }
  if (user.role === ROLE_ASSISTANT_COACH) {
    if (review.status !== STUDENT_REVIEW_STATUS.DRAFT) return false;
    if (review.authorUserId !== user.id) return false;
    return canAccessStudent(user, review.studentId);
  }
  return false;
}

/** Whether the user may apply a new status value in PATCH. */
export function canSetStudentReviewStatus(
  user: SessionScopeUser,
  next: StudentReviewStatus,
): boolean {
  if (next === STUDENT_REVIEW_STATUS.DRAFT) {
    return user.role === ROLE_HEAD_COACH || user.role === ROLE_ADMIN;
  }
  if (next === STUDENT_REVIEW_STATUS.PUBLISHED) {
    return canPublishStudentReview(user);
  }
  return false;
}
