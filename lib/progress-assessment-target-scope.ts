import { NextResponse } from "next/server";
import { forbiddenJson, type SessionUserWithInstitute } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { ROLE_HEAD_COACH } from "@/lib/roles";

/**
 * Head coach: assessment targets must belong to the coach's branch via the student's current batch.
 * Defense in depth after {@link userCanAccessStudentForProgress} (does not replace it).
 */
export async function assertHeadCoachAssessmentTargetBranch(
  user: SessionUserWithInstitute,
  studentId: string,
  batchId: string,
): Promise<NextResponse | null> {
  if (user.role !== ROLE_HEAD_COACH) return null;
  if (!user.branchId) {
    return forbiddenJson(
      "You need a branch assignment to work with assessments.",
      "BRANCH_ASSIGNMENT_REQUIRED",
    );
  }
  const row = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      instituteId: true,
      batchId: true,
      batch: { select: { id: true, branchId: true } },
    },
  });
  if (!row || row.instituteId !== user.instituteId) {
    return apiError({
      code: "STUDENT_NOT_FOUND",
      message: "Student not found.",
      status: 404,
    });
  }
  if (row.batchId !== batchId) {
    return apiError({
      code: "BATCH_ID_MISMATCH",
      message: "batchId does not match the student's current batch.",
      status: 400,
    });
  }
  if (row.batch?.branchId !== user.branchId) {
    return forbiddenJson("This student is outside your branch.", "FORBIDDEN_BRANCH_SCOPE");
  }
  return null;
}
