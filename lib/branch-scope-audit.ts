import { prisma } from "@/lib/prisma";

const TAG = "[branch-scope-audit]";

export function branchScopeAuditEnabled(): boolean {
  return process.env.BRANCH_SCOPE_AUDIT === "1";
}

function safeLog(line: string): void {
  try {
    console.log(line);
  } catch {
    /* never throw from audit */
  }
}

export function logHeadCoachBranchAudit(payload: Record<string, unknown>): void {
  if (!branchScopeAuditEnabled()) return;
  try {
    safeLog(TAG + " " + JSON.stringify({ audit: "head_coach", ...payload }));
  } catch {
    /* no-op */
  }
}

export function logStudentBatchBranchAudit(payload: Record<string, unknown>): void {
  if (!branchScopeAuditEnabled()) return;
  try {
    safeLog(TAG + " " + JSON.stringify({ audit: "student_batch", ...payload }));
  } catch {
    /* no-op */
  }
}

export function logAssistantBatchAudit(payload: Record<string, unknown>): void {
  if (!branchScopeAuditEnabled()) return;
  try {
    safeLog(TAG + " " + JSON.stringify({ audit: "assistant_batch", ...payload }));
  } catch {
    /* no-op */
  }
}

export type BranchScopeConsistencyReport = {
  instituteId: string;
  focusBranchId: string | null;
  batchesWithNullBranchId: number;
  batchesBranchInstituteMismatch: number;
  studentsOnNullBranchBatches: number;
  assistantAssignmentsOnNullBranchBatches: number;
  /** Batches in institute tied to focus branch (when focusBranchId set). */
  batchesOnFocusBranch: number | null;
  /** Students in institute assigned to a batch on focus branch. */
  studentsOnFocusBranchBatches: number | null;
};

/**
 * Read-only counts for branch / institute alignment (diagnostics only).
 */
export async function getBranchScopeConsistencyCounts(
  instituteId: string,
  focusBranchId?: string | null,
): Promise<BranchScopeConsistencyReport> {
  const focus =
    typeof focusBranchId === "string" && focusBranchId.trim() !== ""
      ? focusBranchId.trim()
      : null;

  const [
    batchesWithNullBranchId,
    batchesBranchInstituteMismatch,
    studentsOnNullBranchBatches,
    assistantAssignmentsOnNullBranchBatches,
    batchesOnFocusBranch,
    studentsOnFocusBranchBatches,
  ] = await Promise.all([
    prisma.batch.count({
      where: { instituteId, branchId: null },
    }),
    prisma.batch.count({
      where: {
        instituteId,
        branchId: { not: null },
        OR: [
          { branch: { instituteId: null } },
          { branch: { instituteId: { not: instituteId } } },
        ],
      },
    }),
    prisma.student.count({
      where: {
        instituteId,
        batchId: { not: null },
        batch: { branchId: null },
      },
    }),
    prisma.batchAssistant.count({
      where: {
        batch: { instituteId, branchId: null },
      },
    }),
    focus
      ? prisma.batch.count({
          where: { instituteId, branchId: focus },
        })
      : Promise.resolve(null as number | null),
    focus
      ? prisma.student.count({
          where: {
            instituteId,
            batch: { branchId: focus },
          },
        })
      : Promise.resolve(null as number | null),
  ]);

  return {
    instituteId,
    focusBranchId: focus,
    batchesWithNullBranchId,
    batchesBranchInstituteMismatch,
    studentsOnNullBranchBatches,
    assistantAssignmentsOnNullBranchBatches,
    batchesOnFocusBranch: batchesOnFocusBranch,
    studentsOnFocusBranchBatches: studentsOnFocusBranchBatches,
  };
}

export type HeadCoachEmptyScopeExtra = {
  batchesInInstitute: number;
  batchesWithCoachRecord: number;
  studentsInInstituteWithBatch: number;
  studentsInInstituteUnassignedBatch: number;
  /** Present when headCoachBranchId was non-empty. */
  batchesOnHeadCoachBranch?: number;
  studentsOnHeadCoachBranchBatches?: number;
};

/**
 * Extra institute-level stats when head-coach scoped list is empty (diagnostics only).
 */
export async function getHeadCoachEmptyScopeExtraStats(
  instituteId: string,
  headCoachBranchId: string | null,
): Promise<HeadCoachEmptyScopeExtra> {
  const branch =
    typeof headCoachBranchId === "string" && headCoachBranchId.trim() !== ""
      ? headCoachBranchId.trim()
      : null;

  const [
    batchesInInstitute,
    batchesWithCoachRecord,
    studentsInInstituteWithBatch,
    studentsInInstituteUnassignedBatch,
  ] = await Promise.all([
    prisma.batch.count({ where: { instituteId } }),
    prisma.batch.count({
      where: { instituteId, coachId: { not: null } },
    }),
    prisma.student.count({
      where: { instituteId, batchId: { not: null } },
    }),
    prisma.student.count({
      where: { instituteId, batchId: null },
    }),
  ]);

  if (!branch) {
    return {
      batchesInInstitute,
      batchesWithCoachRecord,
      studentsInInstituteWithBatch,
      studentsInInstituteUnassignedBatch,
    };
  }

  const [batchesOnHeadCoachBranch, studentsOnHeadCoachBranchBatches] = await Promise.all([
    prisma.batch.count({ where: { instituteId, branchId: branch } }),
    prisma.student.count({
      where: {
        instituteId,
        batch: { branchId: branch },
      },
    }),
  ]);

  return {
    batchesInInstitute,
    batchesWithCoachRecord,
    studentsInInstituteWithBatch,
    studentsInInstituteUnassignedBatch,
    batchesOnHeadCoachBranch,
    studentsOnHeadCoachBranchBatches,
  };
}
