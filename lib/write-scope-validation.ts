/**
 * Shared server-side checks for multi-tenant writes (institute / branch / batch integrity).
 * @see docs/write-path-hardening.md
 */

import { prisma } from "@/lib/prisma";

/** Ensures a batch row is usable for roster, attendance, and progress (non-legacy null branch). */
export function assertBatchHasBranchId(branchId: string | null | undefined):
  | { ok: true; branchId: string }
  | { ok: false; error: string } {
  const t = typeof branchId === "string" ? branchId.trim() : "";
  if (!t) {
    return {
      ok: false,
      error:
        "This batch must be assigned to a branch before students can be rostered or attendance and progress can be recorded.",
    };
  }
  return { ok: true, branchId: t };
}

export type BatchTenantRow = {
  id: string;
  instituteId: string | null;
  branchId: string | null;
};

/** Batch in tenant, or null if missing / wrong institute. */
export async function resolveBatchInInstitute(
  batchId: string,
  instituteId: string,
): Promise<BatchTenantRow | null> {
  const row = await prisma.batch.findFirst({
    where: { id: batchId, instituteId },
    select: { id: true, instituteId: true, branchId: true },
  });
  return row;
}

export type StudentTenantRow = {
  id: string;
  instituteId: string | null;
  batchId: string | null;
};

export async function resolveStudentInInstitute(
  studentId: string,
  instituteId: string,
): Promise<StudentTenantRow | null> {
  const row = await prisma.student.findFirst({
    where: { id: studentId, instituteId },
    select: { id: true, instituteId: true, batchId: true },
  });
  return row;
}

/**
 * Validates assigning `studentId` to `nextBatchId` (non-null): same institute, target batch has a branch.
 * Does not check role scope — callers must use {@link canAccessBatch} / roster helpers first.
 */
export async function validateStudentBatchInstituteAlignment(
  studentId: string,
  nextBatchId: string,
  instituteId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const [student, batch] = await Promise.all([
    resolveStudentInInstitute(studentId, instituteId),
    resolveBatchInInstitute(nextBatchId, instituteId),
  ]);
  if (!student) {
    return { ok: false, error: "Student not found.", status: 404 };
  }
  if (!batch) {
    return { ok: false, error: "Batch not found.", status: 404 };
  }
  if (student.instituteId !== batch.instituteId || student.instituteId !== instituteId) {
    return {
      ok: false,
      error: "Student and batch must belong to the same institute.",
      status: 400,
    };
  }
  const br = assertBatchHasBranchId(batch.branchId);
  if (!br.ok) {
    return { ok: false, error: br.error, status: 400 };
  }
  return { ok: true };
}
