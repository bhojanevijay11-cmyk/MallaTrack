import { prisma } from "@/lib/prisma";

/** For nullable `instituteId` backfill across all tenant tables, use `backfillInstituteOwnership` in `./backfill-institute` or `npm run backfill:institute`. */

/**
 * Idempotent: if exactly one Branch exists, set Batch.branchId on rows where it is null.
 * Safe for single-institute deployments; skips when 0 or 2+ branches (no guessing).
 */
export async function backfillLegacyBatchBranchLinks(): Promise<
  | { ok: true; updated: number; branchId: string }
  | { ok: false; reason: string }
> {
  const branches = await prisma.branch.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (branches.length !== 1) {
    return {
      ok: false,
      reason: `Expected exactly one branch; found ${branches.length}.`,
    };
  }
  const branchId = branches[0].id;
  const res = await prisma.batch.updateMany({
    where: { branchId: null },
    data: { branchId },
  });
  return { ok: true, updated: res.count, branchId };
}
