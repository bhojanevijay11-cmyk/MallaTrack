import { prisma } from "@/lib/prisma";
import { headCoachBatchWhereInput } from "@/lib/head-coach-scope";

function normBranch(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export type HeadCoachScopeAuditCounts = {
  instituteBatchCount: number;
  branchBatchCount: number;
  nullBranchBatchCount: number;
  /** Students assigned to a batch in this institute (batch row also scoped to institute). */
  instituteStudentCount: number;
  /** Students in batches whose branchId matches the head coach branch. */
  branchStudentCount: number;
  /** Students in batches with null branchId in this institute. */
  nullBranchStudentCount: number;
};

/**
 * Read-only institute/branch distribution (diagnostics only; does not affect auth).
 */
export async function fetchHeadCoachScopeAuditCounts(
  instituteId: string,
  headCoachBranchId: string | null | undefined,
): Promise<HeadCoachScopeAuditCounts> {
  const branch = normBranch(headCoachBranchId);

  const [
    instituteBatchCount,
    branchBatchCount,
    nullBranchBatchCount,
    instituteStudentCount,
    branchStudentCount,
    nullBranchStudentCount,
  ] = await Promise.all([
    prisma.batch.count({ where: { instituteId } }),
    branch
      ? prisma.batch.count({ where: { instituteId, branchId: branch } })
      : Promise.resolve(0),
    prisma.batch.count({ where: { instituteId, branchId: null } }),
    prisma.student.count({
      where: {
        instituteId,
        batchId: { not: null },
        batch: { instituteId },
      },
    }),
    branch
      ? prisma.student.count({
          where: {
            instituteId,
            batch: { instituteId, branchId: branch },
          },
        })
      : Promise.resolve(0),
    prisma.student.count({
      where: {
        instituteId,
        batchId: { not: null },
        batch: { instituteId, branchId: null },
      },
    }),
  ]);

  return {
    instituteBatchCount,
    branchBatchCount,
    nullBranchBatchCount,
    instituteStudentCount,
    branchStudentCount,
    nullBranchStudentCount,
  };
}

export type HeadCoachScopeAuditExtras = {
  dbBranchId: string | null;
  sessionBranchId: string | null;
  sessionMatchesDb: boolean;
  instituteHasBatchesButNoneForBranch: boolean;
  nullBranchBatchesCauseExclusion: boolean;
};

export async function runHeadCoachScopeAudit(
  instituteId: string,
  sessionBranchId: string | null | undefined,
  userId: string,
): Promise<{ counts: HeadCoachScopeAuditCounts } & HeadCoachScopeAuditExtras> {
  const session = normBranch(sessionBranchId);
  const counts = await fetchHeadCoachScopeAuditCounts(instituteId, session);
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { branchId: true },
  });
  const dbBranchId = normBranch(userRow?.branchId);
  const sessionMatchesDb = session === dbBranchId;
  const instituteHasBatchesButNoneForBranch =
    counts.instituteBatchCount > 0 && counts.branchBatchCount === 0 && session != null;
  const nullBranchBatchesCauseExclusion =
    counts.nullBranchBatchCount > 0 && counts.nullBranchStudentCount > 0;

  return {
    counts,
    dbBranchId,
    sessionBranchId: session,
    sessionMatchesDb,
    instituteHasBatchesButNoneForBranch,
    nullBranchBatchesCauseExclusion,
  };
}

/** Active batches matching head-coach batch scope (same filter as dashboard `activeBatches`). */
export async function countMatchedActiveBatchesHeadCoach(
  headCoachUserBranchId: string | null | undefined,
  instituteId: string,
): Promise<number> {
  const where = headCoachBatchWhereInput(
    headCoachUserBranchId === undefined ? null : headCoachUserBranchId,
    instituteId,
  );
  const rows = await prisma.batch.findMany({
    where,
    select: { status: true },
  });
  return rows.filter((b) => (b.status ?? "").toUpperCase() === "ACTIVE").length;
}
