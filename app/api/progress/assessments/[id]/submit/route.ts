import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { assertProgressAssessmentAccess } from "@/lib/authz-assertions";
import { assertHeadCoachAssessmentTargetBranch } from "@/lib/progress-assessment-target-scope";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import {
  progressAssessmentListSelect,
  serializeProgressAssessmentListRow,
} from "@/lib/progress-assessment-payload";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";

/** Author must still match after role gate (draft / needs-revision → queue or approved by role). */
const SUBMIT_ROLES = [ROLE_ADMIN, ROLE_HEAD_COACH, ROLE_ASSISTANT_COACH] as const;

function notFound() {
  return apiError({ code: "NOT_FOUND", message: "Not found.", status: 404 });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return notFound();

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, SUBMIT_ROLES);
  if (user instanceof NextResponse) return user;

  const existing = await prisma.progressAssessment.findUnique({
    where: { id },
    select: {
      id: true,
      instituteId: true,
      studentId: true,
      batchId: true,
      status: true,
      authorUserId: true,
    },
  });
  if (!existing) return notFound();
  const denied = await assertProgressAssessmentAccess(user, existing);
  if (denied) return denied;

  const deniedBranch = await assertHeadCoachAssessmentTargetBranch(
    user,
    existing.studentId,
    existing.batchId,
  );
  if (deniedBranch) return deniedBranch;

  const liveStudent = await prisma.student.findUnique({
    where: { id: existing.studentId },
    select: { batchId: true, instituteId: true },
  });
  if (!liveStudent || liveStudent.instituteId !== existing.instituteId) {
    return apiError({
      code: "STUDENT_NOT_FOUND",
      message: "Student not found.",
      status: 404,
    });
  }
  if (liveStudent.batchId !== existing.batchId) {
    return apiError({
      code: "BATCH_CHANGED",
      message:
        "This student’s batch assignment changed after this assessment was created. Refresh and open the assessment again.",
      status: 409,
    });
  }

  if (existing.authorUserId !== user.id) {
    return apiError({
      code: "FORBIDDEN_AUTHOR_ONLY",
      message: "Only the author can submit this assessment.",
      status: 403,
    });
  }

  /** Author may submit from DRAFT (first time) or NEEDS_REVISION (resubmit to head-coach queue). */
  if (
    existing.status !== PROGRESS_ASSESSMENT_STATUS.DRAFT &&
    existing.status !== PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION
  ) {
    return apiError({
      code: "INVALID_STATUS",
      message: "Only draft or needs-revision assessments can be submitted.",
      status: 409,
    });
  }

  const now = new Date();
  /** Assistant: queue for head-coach review. Head coach / admin: author finalizes directly to approved. */
  const directFinalize =
    user.role === ROLE_HEAD_COACH || user.role === ROLE_ADMIN;

  const row = await prisma.progressAssessment.update({
    where: { id },
    data: directFinalize
      ? {
          status: PROGRESS_ASSESSMENT_STATUS.APPROVED,
          submittedAt: now,
          submittedByUserId: user.id,
          reviewedAt: now,
          reviewedByUserId: user.id,
        }
      : {
          status: PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW,
          submittedAt: now,
          submittedByUserId: user.id,
        },
    select: progressAssessmentListSelect,
  });

  return NextResponse.json({ ok: true, assessment: serializeProgressAssessmentListRow(row) });
}
