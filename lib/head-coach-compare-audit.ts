import { prisma } from "@/lib/prisma";

function normBranch(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function isActiveBatchStatus(status: string | null | undefined): boolean {
  return (status ?? "").toUpperCase() === "ACTIVE";
}

export type HeadCoachCompareAuditResult = {
  userId: string;
  role: string | null;
  instituteId: string | null;
  /** `User.branchId` from DB (normalized). */
  branchId: string | null;
  instituteActiveBatchCount: number;
  branchActiveBatchCount: number;
  instituteStudentCount: number;
  branchStudentCount: number;
  nullBranchBatchCount: number;
  nullBranchStudentCount: number;
};

/**
 * Read-only snapshot for comparing head-coach accounts (working vs failing).
 * Does not change authorization or queries used elsewhere.
 */
export async function runHeadCoachCompareAudit(
  userId: string,
): Promise<HeadCoachCompareAuditResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, instituteId: true, branchId: true },
  });
  if (!user) return null;

  const instituteId = user.instituteId;
  const branchId = normBranch(user.branchId);

  if (!instituteId) {
    return {
      userId: user.id,
      role: user.role,
      instituteId: null,
      branchId,
      instituteActiveBatchCount: 0,
      branchActiveBatchCount: 0,
      instituteStudentCount: 0,
      branchStudentCount: 0,
      nullBranchBatchCount: 0,
      nullBranchStudentCount: 0,
    };
  }

  const batches = await prisma.batch.findMany({
    where: { instituteId },
    select: { status: true, branchId: true },
  });

  let instituteActiveBatchCount = 0;
  let branchActiveBatchCount = 0;
  let nullBranchBatchCount = 0;
  for (const b of batches) {
    if (!isActiveBatchStatus(b.status)) continue;
    instituteActiveBatchCount++;
    if (b.branchId == null) {
      nullBranchBatchCount++;
    } else if (branchId != null && b.branchId === branchId) {
      branchActiveBatchCount++;
    }
  }

  const [instituteStudentCount, branchStudentCount, nullBranchStudentCount] =
    await Promise.all([
      prisma.student.count({
        where: {
          instituteId,
          batchId: { not: null },
          batch: { instituteId },
        },
      }),
      branchId
        ? prisma.student.count({
            where: {
              instituteId,
              batch: { instituteId, branchId },
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
    userId: user.id,
    role: user.role,
    instituteId,
    branchId,
    instituteActiveBatchCount,
    branchActiveBatchCount,
    instituteStudentCount,
    branchStudentCount,
    nullBranchBatchCount,
    nullBranchStudentCount,
  };
}
