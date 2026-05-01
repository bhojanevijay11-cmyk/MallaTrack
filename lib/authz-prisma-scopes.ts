/**
 * Central Prisma `where` builders for role × institute × branch × batch × parent linkage.
 * Parity audit: `docs/read-scope-audit.md`.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { headCoachBatchWhereInput, headCoachStudentWhereInput } from "@/lib/head-coach-scope";
import { progressAssessmentScopeWhere } from "@/lib/progress-assessment-access";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  ROLE_PARENT,
} from "@/lib/roles";
import {
  operationalBatchWhereInput,
  operationalStudentWhereInput,
} from "@/lib/tenant-integrity-guardrails";

async function assistantAssignedBatchIds(
  userId: string,
  instituteId: string,
): Promise<string[]> {
  const links = await prisma.batchAssistant.findMany({
    where: { userId, batch: { instituteId } },
    select: { batchId: true },
  });
  return [...new Set(links.map((l) => l.batchId))];
}

/** Students visible under role + institute (fail closed for unknown roles). */
export async function buildStudentScopeWhere(
  user: SessionUserWithInstitute,
): Promise<Prisma.StudentWhereInput> {
  const { instituteId } = user;
  const op = operationalStudentWhereInput(instituteId);
  if (user.role === ROLE_ADMIN) {
    return { AND: [{ instituteId }, op] };
  }
  if (user.role === ROLE_HEAD_COACH) {
    return { AND: [headCoachStudentWhereInput(user.branchId, instituteId), op] };
  }
  if (user.role === ROLE_ASSISTANT_COACH) {
    const batchIds = await assistantAssignedBatchIds(user.id, instituteId);
    if (batchIds.length === 0) return { instituteId, id: { in: [] } };
    return {
      AND: [{ instituteId, batchId: { in: batchIds } }, op],
    };
  }
  if (user.role === ROLE_PARENT) {
    return { AND: [{ instituteId, parentUserId: user.id }, op] };
  }
  return { instituteId, id: { in: [] } };
}

export async function buildBatchScopeWhere(
  user: SessionUserWithInstitute,
): Promise<Prisma.BatchWhereInput> {
  const { instituteId } = user;
  const op = operationalBatchWhereInput(instituteId);
  if (user.role === ROLE_ADMIN) {
    return { AND: [{ instituteId }, op] };
  }
  if (user.role === ROLE_HEAD_COACH) {
    return { AND: [headCoachBatchWhereInput(user.branchId, instituteId), op] };
  }
  if (user.role === ROLE_ASSISTANT_COACH) {
    const batchIds = await assistantAssignedBatchIds(user.id, instituteId);
    if (batchIds.length === 0) return { instituteId, id: { in: [] } };
    return { AND: [{ instituteId, id: { in: batchIds } }, op] };
  }
  if (user.role === ROLE_PARENT) {
    return { instituteId, id: { in: [] } };
  }
  return { instituteId, id: { in: [] } };
}

/**
 * Attendance row filter: this institute OR legacy rows with `instituteId: null`.
 * Must always be combined with student scoping (e.g. parent linkage, batch, or explicit studentId)
 * so null-institute rows cannot widen visibility beyond the caller’s intent.
 */
export function attendanceRowsInstituteOrLegacyNull(
  instituteId: string,
): Prisma.AttendanceWhereInput {
  return { instituteId };
}

/** Attendance rows the user may aggregate or list (tenant + batch/student scoping). */
export async function buildAttendanceScopeWhere(
  user: SessionUserWithInstitute,
): Promise<Prisma.AttendanceWhereInput> {
  const base: Prisma.AttendanceWhereInput = { instituteId: user.instituteId };
  const opBatch = operationalBatchWhereInput(user.instituteId);
  if (user.role === ROLE_ADMIN) {
    return { ...base, batch: opBatch };
  }
  if (user.role === ROLE_HEAD_COACH) {
    return {
      ...base,
      AND: [
        { batch: headCoachBatchWhereInput(user.branchId, user.instituteId) },
        { batch: opBatch },
      ],
    };
  }
  if (user.role === ROLE_ASSISTANT_COACH) {
    const batchIds = await assistantAssignedBatchIds(user.id, user.instituteId);
    if (batchIds.length === 0) return { ...base, batchId: { in: [] } };
    return {
      ...base,
      batchId: { in: batchIds },
      batch: opBatch,
    };
  }
  if (user.role === ROLE_PARENT) {
    return {
      AND: [
        attendanceRowsInstituteOrLegacyNull(user.instituteId),
        {
          student: {
            AND: [
              { parentUserId: user.id, instituteId: user.instituteId },
              operationalStudentWhereInput(user.instituteId),
            ],
          },
        },
        { batch: opBatch },
      ],
    };
  }
  return { ...base, batchId: { in: [] } };
}

/** Progress V2 assessments list/detail filter (existing institute + progress student graph). */
export async function buildProgressScopeWhere(
  user: SessionUserWithInstitute,
): Promise<Prisma.ProgressAssessmentWhereInput> {
  return progressAssessmentScopeWhere(user);
}

/** Branch directory within tenant (admin: institute; head coach: single branch when assigned). */
export function buildBranchScopeWhere(user: SessionUserWithInstitute): Prisma.BranchWhereInput {
  const { instituteId } = user;
  if (user.role === ROLE_ADMIN) {
    return { instituteId };
  }
  if (user.role === ROLE_HEAD_COACH && user.branchId) {
    return { instituteId, id: user.branchId };
  }
  if (user.role === ROLE_HEAD_COACH) {
    return { instituteId, id: { in: [] } };
  }
  if (user.role === ROLE_ASSISTANT_COACH || user.role === ROLE_PARENT) {
    return { instituteId, id: { in: [] } };
  }
  return { instituteId, id: { in: [] } };
}
