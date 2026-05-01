/**
 * Explicit admin-only repairs (grep: tenant-integrity-repair).
 * No bulk jobs, no cross-tenant work, no guessed reassignment.
 */
import { prisma } from "@/lib/prisma";
import {
  logBatchBranchChange,
  validateBatchBranchChangeForAdmin,
} from "@/lib/batch-branch-assignment";
import { logTenantIntegrityRepair } from "@/lib/tenant-integrity-log";

export type TenantRepairResult =
  | { ok: true; message: string }
  | { ok: false; error: string; status: number };

export async function repairAssignBatchBranch(input: {
  instituteId: string;
  actorUserId: string;
  batchId: string;
  branchId: string;
}): Promise<TenantRepairResult> {
  const batchId = input.batchId.trim();
  const branchId = input.branchId.trim();
  if (!batchId || !branchId) {
    return { ok: false, error: "batchId and branchId are required.", status: 400 };
  }

  const batch = await prisma.batch.findFirst({
    where: { id: batchId, instituteId: input.instituteId },
    select: { id: true, instituteId: true, branchId: true },
  });
  if (!batch) {
    return { ok: false, error: "Batch not found.", status: 404 };
  }
  const current = batch.branchId?.trim() ?? null;
  if (current !== null) {
    return {
      ok: false,
      error:
        "This batch already has a branch. Use the standard batch settings flow to change it.",
      status: 409,
    };
  }

  const v = await validateBatchBranchChangeForAdmin(batchId, input.instituteId, branchId);
  if (!v.ok) {
    return { ok: false, error: v.error, status: v.status };
  }
  if (!v.changed) {
    return { ok: true, message: "No change (branch already assigned)." };
  }

  await prisma.batch.update({
    where: { id: batchId },
    data: { branchId: v.newBranchId },
  });

  logBatchBranchChange({
    actorUserId: input.actorUserId,
    batchId,
    oldBranchId: v.oldBranchId,
    newBranchId: v.newBranchId,
  });
  logTenantIntegrityRepair({
    action: "assign_batch_branch",
    actorUserId: input.actorUserId,
    entityType: "Batch",
    recordId: batchId,
    instituteId: input.instituteId,
    reason: "batch.missing_branch",
    detail: { branchId: v.newBranchId },
  });

  return { ok: true, message: "Branch assigned to batch." };
}

export async function repairClearBatchOrphanBranchFk(input: {
  instituteId: string;
  actorUserId: string;
  batchId: string;
}): Promise<TenantRepairResult> {
  const batchId = input.batchId.trim();
  if (!batchId) {
    return { ok: false, error: "batchId is required.", status: 400 };
  }

  const batch = await prisma.batch.findFirst({
    where: { id: batchId, instituteId: input.instituteId },
    select: {
      id: true,
      instituteId: true,
      branchId: true,
      branch: { select: { id: true, instituteId: true } },
    },
  });
  if (!batch) {
    return { ok: false, error: "Batch not found.", status: 404 };
  }
  const bid = batch.branchId?.trim() ?? null;
  if (!bid) {
    return { ok: false, error: "Batch has no branchId to clear.", status: 409 };
  }
  if (batch.branch) {
    return {
      ok: false,
      error: "Branch row exists; this is not an orphan branch FK.",
      status: 409,
    };
  }

  await prisma.batch.update({
    where: { id: batchId },
    data: { branchId: null },
  });

  logTenantIntegrityRepair({
    action: "clear_batch_orphan_branch_fk",
    actorUserId: input.actorUserId,
    entityType: "Batch",
    recordId: batchId,
    instituteId: input.instituteId,
    reason: "batch.branch_orphan_fk",
    detail: { staleBranchId: bid },
  });

  return { ok: true, message: "Invalid batch branchId cleared (set to null)." };
}

export async function repairClearStudentOrphanBatchFk(input: {
  instituteId: string;
  actorUserId: string;
  studentId: string;
}): Promise<TenantRepairResult> {
  const studentId = input.studentId.trim();
  if (!studentId) {
    return { ok: false, error: "studentId is required.", status: 400 };
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, instituteId: input.instituteId },
    select: { id: true, instituteId: true, batchId: true },
  });
  if (!student) {
    return { ok: false, error: "Student not found.", status: 404 };
  }
  const sid = student.batchId?.trim() ?? null;
  if (!sid) {
    return { ok: false, error: "Student has no batchId to clear.", status: 409 };
  }

  const batch = await prisma.batch.findUnique({
    where: { id: sid },
    select: { id: true },
  });
  if (batch) {
    return {
      ok: false,
      error: "Batch row exists; this is not an orphan batch FK.",
      status: 409,
    };
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { batchId: null },
  });

  logTenantIntegrityRepair({
    action: "clear_student_orphan_batch_fk",
    actorUserId: input.actorUserId,
    entityType: "Student",
    recordId: studentId,
    instituteId: input.instituteId,
    reason: "student.batch_orphan_fk",
    detail: { staleBatchId: sid },
  });

  return { ok: true, message: "Invalid student batchId cleared (set to null)." };
}
