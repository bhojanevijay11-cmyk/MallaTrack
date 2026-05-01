import { prisma } from "@/lib/prisma";
import { headCoachActiveEnrollmentWhereInput } from "@/lib/head-coach-scope";

function normBranch(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function batchIsActiveStatus(status: string | null | undefined): boolean {
  return (status ?? "").toUpperCase() === "ACTIVE";
}

type BatchLink = {
  branchId: string | null;
  status: string | null;
  instituteId: string | null;
} | null;

type ActiveStudentRow = {
  id: string;
  fullName: string;
  batchId: string | null;
  batch: BatchLink;
};

export type StudentBranchLinkageSummary = {
  totalActiveStudentsInInstitute: number;
  studentsWithBatch: number;
  studentsWithoutBatch: number;
  studentsWhoseBatchBelongsToBranch: number;
  studentsWhoseBatchBelongsToDifferentBranch: number;
  studentsWhoseBatchHasNullBranch: number;
  studentsInInactiveBatches: number;
  studentsVisibleToHeadCoachCurrentScope: number;
};

export type StudentBranchSampleRow = {
  id: string;
  fullName: string;
  /** Student model has no email; reserved for future linkage. */
  email: null;
};

export type StudentBranchLinkageSamples = {
  no_batch: StudentBranchSampleRow[];
  batch_branch_null: StudentBranchSampleRow[];
  batch_branch_other: StudentBranchSampleRow[];
  inactive_batch: StudentBranchSampleRow[];
  branch_scope_match: StudentBranchSampleRow[];
};

export type StudentBranchAuditPayload = StudentBranchLinkageSummary & {
  userId: string;
  instituteId: string;
  branchId: string | null;
  excludedByReason: {
    no_batch: number;
    batch_branch_null: number;
    batch_branch_other: number;
    /** Excluded-from-HC-scope students whose batch row is not ACTIVE (subset of exclusions). */
    inactive_batch: number;
  };
};

const DEFAULT_SAMPLE_LIMIT = 8;

function toSample(row: Pick<ActiveStudentRow, "id" | "fullName">): StudentBranchSampleRow {
  return { id: row.id, fullName: row.fullName, email: null };
}

function resolveBatchForStudent(
  instituteId: string,
  row: ActiveStudentRow,
): BatchLink {
  if (!row.batchId || !row.batch) return null;
  if (row.batch.instituteId != null && row.batch.instituteId !== instituteId) return null;
  return row.batch;
}

function isVisibleToHeadCoachCurrentScope(
  coachBranchId: string | null,
  instituteId: string,
  row: ActiveStudentRow,
): boolean {
  const b = normBranch(coachBranchId);
  if (!b) return false;
  const batch = resolveBatchForStudent(instituteId, row);
  if (!batch || row.batchId == null) return false;
  return batch.branchId === b;
}

function pushSample(
  bucket: StudentBranchSampleRow[],
  row: ActiveStudentRow,
  limit: number,
): void {
  if (bucket.length >= limit) return;
  bucket.push(toSample(row));
}

async function loadActiveStudentsForLinkageAudit(
  instituteId: string,
): Promise<ActiveStudentRow[]> {
  try {
    return await prisma.student.findMany({
      where: { instituteId, status: "ACTIVE" },
      select: {
        id: true,
        fullName: true,
        batchId: true,
        batch: { select: { branchId: true, status: true, instituteId: true } },
      },
    });
  } catch {
    return [];
  }
}

function computeStudentBranchLinkageSummaryFromRows(
  instituteId: string,
  coachBranchId: string | null,
  rows: ActiveStudentRow[],
): StudentBranchLinkageSummary {
  const branchId = normBranch(coachBranchId);

  let totalActiveStudentsInInstitute = 0;
  let studentsWithBatch = 0;
  let studentsWithoutBatch = 0;
  let studentsWhoseBatchBelongsToBranch = 0;
  let studentsWhoseBatchBelongsToDifferentBranch = 0;
  let studentsWhoseBatchHasNullBranch = 0;
  let studentsInInactiveBatches = 0;
  let studentsVisibleToHeadCoachCurrentScope = 0;

  for (const row of rows) {
    totalActiveStudentsInInstitute++;
    const batch = resolveBatchForStudent(instituteId, row);
    const hasValidBatch = !!batch && row.batchId != null;

    if (!hasValidBatch) {
      studentsWithoutBatch++;
    } else {
      studentsWithBatch++;
      if (!batchIsActiveStatus(batch!.status)) {
        studentsInInactiveBatches++;
      }
      if (batch!.branchId == null) {
        studentsWhoseBatchHasNullBranch++;
      } else if (branchId != null && batch!.branchId === branchId) {
        studentsWhoseBatchBelongsToBranch++;
      } else if (batch!.branchId != null && (branchId == null || batch!.branchId !== branchId)) {
        studentsWhoseBatchBelongsToDifferentBranch++;
      }
    }

    if (isVisibleToHeadCoachCurrentScope(branchId, instituteId, row)) {
      studentsVisibleToHeadCoachCurrentScope++;
    }
  }

  return {
    totalActiveStudentsInInstitute,
    studentsWithBatch,
    studentsWithoutBatch,
    studentsWhoseBatchBelongsToBranch,
    studentsWhoseBatchBelongsToDifferentBranch,
    studentsWhoseBatchHasNullBranch,
    studentsInInactiveBatches,
    studentsVisibleToHeadCoachCurrentScope,
  };
}

/**
 * Read-only counts for ACTIVE students vs batch/branch linkage (diagnostics only).
 */
export async function fetchStudentBranchLinkageSummary(
  instituteId: string,
  coachBranchId: string | null | undefined,
): Promise<StudentBranchLinkageSummary> {
  const branchId = normBranch(coachBranchId);
  const rows = await loadActiveStudentsForLinkageAudit(instituteId);
  return computeStudentBranchLinkageSummaryFromRows(instituteId, branchId, rows);
}

/**
 * Small samples (ids + names only) grouped by diagnostic reason.
 */
export async function fetchStudentBranchLinkageDetailedSamples(
  instituteId: string,
  coachBranchId: string | null | undefined,
  options?: { limitPerReason?: number },
): Promise<StudentBranchLinkageSamples> {
  const branchId = normBranch(coachBranchId);
  const limit = options?.limitPerReason ?? DEFAULT_SAMPLE_LIMIT;
  const rows = await loadActiveStudentsForLinkageAudit(instituteId);

  const out: StudentBranchLinkageSamples = {
    no_batch: [],
    batch_branch_null: [],
    batch_branch_other: [],
    inactive_batch: [],
    branch_scope_match: [],
  };

  for (const row of rows) {
    const batch = resolveBatchForStudent(instituteId, row);
    const hasValidBatch = !!batch && row.batchId != null;
    const visible = isVisibleToHeadCoachCurrentScope(branchId, instituteId, row);

    if (visible) {
      pushSample(out.branch_scope_match, row, limit);
    }

    if (!hasValidBatch) {
      pushSample(out.no_batch, row, limit);
      continue;
    }

    if (!batchIsActiveStatus(batch!.status) && !visible) {
      pushSample(out.inactive_batch, row, limit);
    }

    if (batch!.branchId == null) {
      pushSample(out.batch_branch_null, row, limit);
    } else if (branchId == null || batch!.branchId !== branchId) {
      pushSample(out.batch_branch_other, row, limit);
    }
  }

  return out;
}

function computeExcludedByReason(
  instituteId: string,
  coachBranchId: string | null,
  rows: ActiveStudentRow[],
): StudentBranchAuditPayload["excludedByReason"] {
  const branchId = normBranch(coachBranchId);
  const excludedByReason: StudentBranchAuditPayload["excludedByReason"] = {
    no_batch: 0,
    batch_branch_null: 0,
    batch_branch_other: 0,
    inactive_batch: 0,
  };

  for (const row of rows) {
    if (isVisibleToHeadCoachCurrentScope(branchId, instituteId, row)) continue;

    const batch = resolveBatchForStudent(instituteId, row);
    const hasValidBatch = !!batch && row.batchId != null;

    if (!hasValidBatch) {
      excludedByReason.no_batch++;
      continue;
    }
    if (batch!.branchId == null) {
      excludedByReason.batch_branch_null++;
    } else if (branchId == null || batch!.branchId !== branchId) {
      excludedByReason.batch_branch_other++;
    }

    if (!batchIsActiveStatus(batch!.status)) {
      excludedByReason.inactive_batch++;
    }
  }

  return excludedByReason;
}

/**
 * Compare institute ACTIVE students to {@link headCoachActiveEnrollmentWhereInput} visibility.
 * Read-only; does not throw.
 */
export async function compareAdminActiveStudentsToHeadCoachBranchScope(
  userId: string,
  instituteId: string,
  coachBranchId: string | null | undefined,
): Promise<StudentBranchAuditPayload> {
  const branchId = normBranch(coachBranchId);
  const rows = await loadActiveStudentsForLinkageAudit(instituteId);
  const summary = computeStudentBranchLinkageSummaryFromRows(instituteId, branchId, rows);
  const excludedByReason = computeExcludedByReason(instituteId, branchId, rows);

  let studentsVisibleToHeadCoachCurrentScope = summary.studentsVisibleToHeadCoachCurrentScope;
  try {
    const dbCount = await prisma.student.count({
      where: headCoachActiveEnrollmentWhereInput(branchId, instituteId),
    });
    studentsVisibleToHeadCoachCurrentScope = dbCount;
  } catch {
    /* keep summary-derived count */
  }

  return {
    userId,
    instituteId,
    branchId,
    ...summary,
    studentsVisibleToHeadCoachCurrentScope,
    excludedByReason,
  };
}

export function debugLogStudentBranchAudit(payload: Record<string, unknown>): void {
  if (process.env.HEAD_COACH_SCOPE_DEBUG !== "1") return;
  try {
    console.log(
      "[student-branch-audit]",
      JSON.stringify({ ...payload, at: new Date().toISOString() }),
    );
  } catch {
    /* diagnostics only */
  }
}
