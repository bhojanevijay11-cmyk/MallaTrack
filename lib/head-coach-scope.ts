import type { Prisma } from "@prisma/client";

/**
 * Head Coach batch visibility: strictly the branch assigned on the user (`user.branchId`).
 * Without a branch assignment, visibility is empty (fail closed — institute-wide access is invalid).
 */
export function headCoachBatchWhereInput(
  headCoachUserBranchId: string | null,
  instituteId: string,
): Prisma.BatchWhereInput {
  if (!headCoachUserBranchId) {
    return { instituteId, id: { in: [] } };
  }
  return {
    instituteId,
    branchId: headCoachUserBranchId,
    branch: { id: headCoachUserBranchId, instituteId },
  };
}

/**
 * Students visible to Head Coach: assigned to a batch in their branch only.
 * Unassigned students and legacy batches without a branch are excluded.
 */
export function headCoachStudentWhereInput(
  headCoachUserBranchId: string | null,
  instituteId: string,
): Prisma.StudentWhereInput {
  if (!headCoachUserBranchId) {
    return { instituteId, id: { in: [] } };
  }
  return {
    instituteId,
    batchId: { not: null },
    batch: {
      instituteId,
      branchId: headCoachUserBranchId,
      branch: { id: headCoachUserBranchId, instituteId },
    },
  };
}

/** ACTIVE students counted for enrollment / attendance rate denominator on Head Coach dashboard. */
export function headCoachActiveEnrollmentWhereInput(
  headCoachUserBranchId: string | null,
  instituteId: string,
): Prisma.StudentWhereInput {
  return {
    status: "ACTIVE",
    ...headCoachStudentWhereInput(headCoachUserBranchId, instituteId),
  };
}
