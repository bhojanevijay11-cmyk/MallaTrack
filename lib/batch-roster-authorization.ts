import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { canAccessBatch, canAccessStudent } from "@/lib/scope";
import { assertBatchHasBranchId } from "@/lib/write-scope-validation";

/**
 * Validates bulk assign-to-batch: target batch in caller scope, every student in institute,
 * each student visible to caller, and any current batch assignment is also in caller scope
 * (prevents moving students from batches the caller cannot access).
 */
export async function verifyStudentIdsAssignableToBatch(
  user: SessionUserWithInstitute,
  batchId: string,
  studentIds: string[],
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const targetOk = await canAccessBatch(user, batchId);
  if (!targetOk) {
    return { ok: false, error: "Batch not found.", status: 404 };
  }

  const unique = [...new Set(studentIds)];
  if (unique.length === 0) {
    return { ok: false, error: "studentIds must contain at least one id.", status: 400 };
  }

  const batch = await prisma.batch.findFirst({
    where: { id: batchId, instituteId: user.instituteId },
    select: { id: true, instituteId: true, branchId: true },
  });
  if (!batch?.instituteId) {
    return { ok: false, error: "Batch not found.", status: 404 };
  }
  const branchOk = assertBatchHasBranchId(batch.branchId);
  if (!branchOk.ok) {
    return { ok: false, error: branchOk.error, status: 400 };
  }

  const students = await prisma.student.findMany({
    where: { id: { in: unique }, instituteId: user.instituteId },
    select: { id: true, batchId: true },
  });
  if (students.length !== unique.length) {
    return {
      ok: false,
      error: "One or more students were not found or belong to a different institute.",
      status: 400,
    };
  }

  for (const s of students) {
    if (!(await canAccessStudent(user, s.id))) {
      return {
        ok: false,
        error: "One or more students are not in scope for this operation.",
        status: 400,
      };
    }
    if (s.batchId) {
      if (!(await canAccessBatch(user, s.batchId))) {
        return {
          ok: false,
          error: "One or more students are assigned to a batch outside your authorized scope.",
          status: 400,
        };
      }
    }
  }

  return { ok: true };
}
