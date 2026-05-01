import { prisma } from "@/lib/prisma";

function normBranchId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t.length > 0 ? t : null;
}

export type BatchBranchValidationResult =
  | {
      ok: true;
      oldBranchId: string | null;
      newBranchId: string | null;
      /** False when the normalized branch is unchanged (no assistant checks / logging needed). */
      changed: boolean;
    }
  | { ok: false; error: string; status: number };

/**
 * Admin-only validation before persisting a batch branch change.
 * Blocks only real cross-branch conflicts: if an assigned assistant has a non-null
 * `user.branchId` different from the batch's new branch, the move is rejected (409).
 * Assistants with no home branch (`user.branchId` null) are allowed — common on legacy
 * batches that had no branch; adding new assistants after the move still follows POST
 * /api/batches/:id/assistants rules.
 */
export async function validateBatchBranchChangeForAdmin(
  batchId: string,
  instituteId: string,
  newBranchIdRaw: string | null,
): Promise<BatchBranchValidationResult> {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, instituteId },
    select: { id: true, branchId: true },
  });
  if (!batch) {
    return { ok: false, error: "Batch not found.", status: 404 };
  }

  const oldBranchId = normBranchId(batch.branchId);
  const newBranchId = normBranchId(newBranchIdRaw);

  if (newBranchId === null && oldBranchId !== null) {
    return {
      ok: false,
      error: "Batch must be assigned to a branch.",
      status: 400,
    };
  }

  if (oldBranchId === newBranchId) {
    return { ok: true, oldBranchId, newBranchId, changed: false };
  }

  if (newBranchId !== null) {
    const branch = await prisma.branch.findFirst({
      where: { id: newBranchId, instituteId },
      select: { id: true },
    });
    if (!branch) {
      return {
        ok: false,
        error: "Invalid branch for this institute.",
        status: 400,
      };
    }
  }

  if (newBranchId !== null) {
    const rows = await prisma.batchAssistant.findMany({
      where: { batchId },
      include: { user: { select: { branchId: true } } },
    });
    const conflict = rows.some((r) => {
      const home = normBranchId(r.user.branchId);
      if (home === null) return false;
      return home !== newBranchId;
    });
    if (conflict) {
      return {
        ok: false,
        error:
          "This batch has assistant coaches assigned to a different branch. Remove those assistants or change their branch in staff settings, then try again.",
        status: 409,
      };
    }
  }

  return { ok: true, oldBranchId, newBranchId, changed: true };
}

export function logBatchBranchChange(payload: {
  actorUserId: string;
  batchId: string;
  oldBranchId: string | null;
  newBranchId: string | null;
}): void {
  try {
    console.log(
      "[batch-branch-change]",
      JSON.stringify({ ...payload, at: new Date().toISOString() }),
    );
  } catch {
    /* diagnostics only */
  }
}
