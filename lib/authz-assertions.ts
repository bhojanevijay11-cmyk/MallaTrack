import { NextResponse } from "next/server";
import { forbiddenJson, type SessionUserWithInstitute } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { progressAssessmentVisibleToUser } from "@/lib/progress-assessment-access";
import { progressAssessmentDetailInclude } from "@/lib/progress-assessment-payload";
import { userCanAccessStudentForProgress } from "@/lib/progress-access";
import { canAccessBatch, canAccessStudent } from "@/lib/scope";

function notFoundJson() {
  return apiError({ code: "NOT_FOUND", message: "Not found.", status: 404 });
}

/** Entity reads/mutations outside the progress workflow (students, batches, attendance batch). */
export async function assertStudentAccess(
  user: SessionUserWithInstitute,
  studentId: string,
): Promise<NextResponse | null> {
  if (!(await canAccessStudent(user, studentId))) {
    return forbiddenJson("You cannot access this student.", "FORBIDDEN_STUDENT_SCOPE");
  }
  return null;
}

/** Progress / Progress V2 student graph (excludes parents; institute + role scope). */
export async function assertStudentForProgress(
  user: SessionUserWithInstitute,
  studentId: string,
  message = "You cannot access progress for this student.",
): Promise<NextResponse | null> {
  const allowed = await userCanAccessStudentForProgress(user, studentId);
  if (!allowed) return forbiddenJson(message, "FORBIDDEN_PROGRESS_SCOPE");
  return null;
}

export async function assertBatchAccess(
  user: SessionUserWithInstitute,
  batchId: string,
  message = "You cannot access this batch.",
): Promise<NextResponse | null> {
  if (!(await canAccessBatch(user, batchId))) {
    return forbiddenJson(message, "FORBIDDEN_BATCH_SCOPE");
  }
  return null;
}

/** Progress V2 assessment visibility (institute + progress student scope + operational guardrails). */
export async function assertProgressAssessmentAccess(
  user: SessionUserWithInstitute,
  row: { id: string },
): Promise<NextResponse | null> {
  const full = await prisma.progressAssessment.findUnique({
    where: { id: row.id },
    include: progressAssessmentDetailInclude,
  });
  if (!full) return notFoundJson();
  if (
    !(await progressAssessmentVisibleToUser(user, {
      id: full.id,
      instituteId: full.instituteId,
      studentId: full.studentId,
      batchId: full.batchId,
      student: full.student,
      batch: full.batch,
    }))
  ) {
    return notFoundJson();
  }
  return null;
}

/**
 * Batch-level attendance load/submit: user must see the batch.
 * Matches `/api/attendance` behavior (404 for missing or out-of-scope batch).
 */
export async function assertAttendanceAccess(
  user: SessionUserWithInstitute,
  batchId: string,
): Promise<NextResponse | null> {
  if (!(await canAccessBatch(user, batchId))) {
    return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
  }
  return null;
}

/** Invite row must belong to the caller's institute (admin flows). */
export async function assertInviteAccess(
  user: SessionUserWithInstitute,
  inviteId: string,
): Promise<NextResponse | null> {
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: { instituteId: true },
  });
  if (!invite || invite.instituteId !== user.instituteId) {
    return notFoundJson();
  }
  return null;
}
