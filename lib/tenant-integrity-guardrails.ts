/**
 * Operational tenant-integrity guardrails for read paths (grep: tenant-integrity-guardrails).
 * Invalid linkage (orphan FK, missing branch, institute/branch mismatch, stale assessment batch)
 * is excluded from app behavior; see docs/tenant-integrity-repair.md.
 */
import type { Prisma } from "@prisma/client";

/** Batch is usable when it has a real branch in the same institute (not orphan FK, not mismatched). */
export function batchRecordOperationallyValid(b: {
  instituteId: string | null | undefined;
  branchId: string | null | undefined;
  branch: { instituteId: string | null | undefined } | null | undefined;
}): boolean {
  const inst = b.instituteId?.trim() ?? "";
  if (!inst) return false;
  const bid = b.branchId?.trim() ?? "";
  if (!bid) return false;
  const br = b.branch;
  if (!br) return false;
  const bInst = br.instituteId?.trim() ?? "";
  if (!bInst || bInst !== inst) return false;
  return true;
}

/** Student is listed/used when institute is set and any batch assignment is fully consistent. */
export function studentRecordOperationallyValid(s: {
  instituteId: string | null | undefined;
  batchId: string | null | undefined;
  batch:
    | {
        instituteId: string | null | undefined;
        branchId: string | null | undefined;
        branch: { instituteId: string | null | undefined } | null | undefined;
      }
    | null
    | undefined;
}): boolean {
  const inst = s.instituteId?.trim() ?? "";
  if (!inst) return false;
  const bid = s.batchId?.trim() ?? "";
  if (!bid) return true;
  const batch = s.batch;
  if (!batch) return false;
  const bInst = batch.instituteId?.trim() ?? "";
  if (!bInst || bInst !== inst) return false;
  return batchRecordOperationallyValid({
    instituteId: batch.instituteId,
    branchId: batch.branchId,
    branch: batch.branch,
  });
}

export function operationalBatchWhereInput(instituteId: string): Prisma.BatchWhereInput {
  return {
    instituteId,
    branchId: { not: null },
    branch: { instituteId },
  };
}

export function operationalStudentWhereInput(instituteId: string): Prisma.StudentWhereInput {
  return {
    instituteId,
    OR: [
      { batchId: null },
      {
        batchId: { not: null },
        batch: operationalBatchWhereInput(instituteId),
      },
    ],
  };
}

export type ProgressAssessmentGuardrailRow = {
  instituteId: string;
  studentId: string;
  batchId: string;
  student: {
    instituteId: string | null;
    batchId: string | null;
    batch:
      | {
          instituteId: string | null;
          branchId: string | null;
          branch: { instituteId: string | null } | null;
        }
      | null;
  };
  batch: {
    instituteId: string | null;
    branchId: string | null;
    branch: { instituteId: string | null } | null;
  };
};

export function progressAssessmentRecordOperationallyVisible(
  row: ProgressAssessmentGuardrailRow,
): boolean {
  if (row.instituteId !== row.student.instituteId) return false;
  if (row.instituteId !== row.batch.instituteId) return false;
  if (!studentRecordOperationallyValid(row.student)) return false;
  if (!batchRecordOperationallyValid(row.batch)) return false;
  if (row.student.batchId !== row.batchId) return false;
  return true;
}

export type AttendanceGuardrailRow = {
  instituteId: string | null;
  batchId: string;
  studentId: string;
  student: {
    instituteId: string | null;
    batchId: string | null;
    batch:
      | {
          instituteId: string | null;
          branchId: string | null;
          branch: { instituteId: string | null } | null;
        }
      | null;
  };
  batch: {
    instituteId: string | null;
    branchId: string | null;
    branch: { instituteId: string | null } | null;
  };
};

export function attendanceRecordOperationallyVisible(row: AttendanceGuardrailRow): boolean {
  const batchInst = row.batch.instituteId?.trim() ?? "";
  if (!batchInst) return false;
  if (row.instituteId != null && row.instituteId !== batchInst) return false;
  const stuInst = row.student.instituteId?.trim() ?? "";
  if (stuInst && stuInst !== batchInst) return false;
  if (!batchRecordOperationallyValid(row.batch)) return false;
  if (!studentRecordOperationallyValid(row.student)) return false;
  if (row.student.batchId !== row.batchId) return false;
  return true;
}
