import { prisma } from "@/lib/prisma";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  ROLE_PARENT,
} from "@/lib/roles";
import type { SessionScopeUser } from "@/lib/auth-types";
import {
  batchRecordOperationallyValid,
  studentRecordOperationallyValid,
} from "@/lib/tenant-integrity-guardrails";

export type { SessionScopeUser };

function tenantMissing(user: SessionScopeUser): boolean {
  return user.instituteId === null;
}

/** Whether the user may read/write this batch for API scope checks. */
export async function canAccessBatch(
  user: SessionScopeUser,
  batchId: string,
): Promise<boolean> {
  if (tenantMissing(user)) return false;

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      branchId: true,
      instituteId: true,
      branch: { select: { instituteId: true } },
    },
  });
  if (!batch) return false;
  if (batch.instituteId !== user.instituteId) return false;
  if (!batchRecordOperationallyValid(batch)) return false;

  if (user.role === ROLE_ADMIN) return true;
  if (user.role === ROLE_HEAD_COACH) {
    if (!user.branchId) return false;
    return batch.branchId === user.branchId;
  }
  if (user.role === ROLE_ASSISTANT_COACH) {
    const link = await prisma.batchAssistant.findFirst({
      where: {
        batchId,
        userId: user.id,
        batch: { instituteId: user.instituteId },
      },
      select: { id: true },
    });
    return !!link;
  }
  return false;
}

export async function canAccessStudent(
  user: SessionScopeUser,
  studentId: string,
): Promise<boolean> {
  if (tenantMissing(user)) return false;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      batchId: true,
      instituteId: true,
      parentUserId: true,
      batch: {
        select: {
          branchId: true,
          instituteId: true,
          branch: { select: { instituteId: true } },
        },
      },
    },
  });
  if (!student) return false;
  if (student.instituteId !== user.instituteId) return false;
  if (!studentRecordOperationallyValid(student)) return false;

  if (user.role === ROLE_PARENT) {
    return student.parentUserId === user.id;
  }

  if (user.role === ROLE_ADMIN) return true;
  if (user.role === ROLE_HEAD_COACH) {
    if (!user.branchId) return false;
    if (!student.batchId) return false;
    const bid = student.batch?.branchId;
    if (bid == null) return false;
    return user.branchId === bid;
  }
  if (user.role === ROLE_ASSISTANT_COACH) {
    if (!student.batchId) return false;
    return canAccessBatch(user, student.batchId);
  }
  return false;
}
