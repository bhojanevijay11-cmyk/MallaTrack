import type { Prisma } from "@prisma/client";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { buildStudentScopeWhere } from "@/lib/authz-prisma-scopes";
import { ROLE_PARENT } from "@/lib/roles";
import {
  STUDENT_REVIEW_STATUS,
  STUDENT_REVIEW_VISIBILITY,
} from "@/lib/student-review-constants";

/**
 * Where clause for listing/counting coach feedback (StudentReview) for a single student,
 * aligned with {@link buildStudentScopeWhere}: parents only see published parent-visible notes;
 * staff see all statuses only when the student is in their role scope (branch for head coach, etc.).
 */
export async function buildStudentReviewListWhere(
  user: SessionUserWithInstitute,
  studentId: string,
): Promise<Prisma.StudentReviewWhereInput> {
  const sid = studentId.trim();
  const studentScope = await buildStudentScopeWhere(user);
  const tenant: Prisma.StudentReviewWhereInput = {
    studentId: sid,
    instituteId: user.instituteId,
    student: studentScope,
  };
  if (user.role === ROLE_PARENT) {
    return {
      AND: [
        tenant,
        { status: STUDENT_REVIEW_STATUS.PUBLISHED },
        { visibility: STUDENT_REVIEW_VISIBILITY.PARENT_VISIBLE },
      ],
    };
  }
  return tenant;
}
