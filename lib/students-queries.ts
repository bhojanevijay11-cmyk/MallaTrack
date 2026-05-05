import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { buildStudentScopeWhere } from "@/lib/authz-prisma-scopes";
import { prisma } from "@/lib/prisma";
import { headCoachStudentWhereInput } from "@/lib/head-coach-scope";
import { ROLE_PARENT } from "@/lib/roles";
import {
  operationalStudentWhereInput,
  studentRecordOperationallyValid,
} from "@/lib/tenant-integrity-guardrails";
import { logTenantIntegrityGuardrail } from "@/lib/tenant-integrity-log";
import { assertBatchHasBranchId } from "@/lib/write-scope-validation";

export const studentBatchInclude = {
  batch: {
    select: {
      id: true,
      name: true,
      branch: { select: { name: true } },
    },
  },
} as const;

export type StudentsListScope =
  | { kind: "institute"; instituteId: string }
  | { kind: "branch"; branchId: string; instituteId: string }
  | { kind: "head_coach"; branchId: string | null; instituteId: string }
  | { kind: "assistant"; userId: string; instituteId: string };

export async function getStudentsOrderedForScope(scope: StudentsListScope) {
  const op = operationalStudentWhereInput(scope.instituteId);
  if (scope.kind === "institute") {
    return prisma.student.findMany({
      where: { AND: [{ instituteId: scope.instituteId }, op] },
      orderBy: { createdAt: "desc" },
      include: studentBatchInclude,
    });
  }
  if (scope.kind === "branch") {
    return prisma.student.findMany({
      where: {
        AND: [
          {
            instituteId: scope.instituteId,
            batch: { branchId: scope.branchId },
          },
          op,
        ],
      },
      orderBy: { createdAt: "desc" },
      include: studentBatchInclude,
    });
  }
  if (scope.kind === "head_coach") {
    return prisma.student.findMany({
      where: {
        AND: [headCoachStudentWhereInput(scope.branchId, scope.instituteId), op],
      },
      orderBy: { createdAt: "desc" },
      include: studentBatchInclude,
    });
  }
  const links = await prisma.batchAssistant.findMany({
    where: {
      userId: scope.userId,
      batch: { instituteId: scope.instituteId },
    },
    select: { batchId: true },
  });
  const batchIds = [...new Set(links.map((l) => l.batchId))];
  if (batchIds.length === 0) return [];
  return prisma.student.findMany({
    where: {
      AND: [
        { batchId: { in: batchIds }, instituteId: scope.instituteId },
        op,
      ],
    },
    orderBy: { createdAt: "desc" },
    include: studentBatchInclude,
  });
}

/** Admin dashboard: all students in one institute. */
export async function getStudentsOrderedByCreatedDesc(instituteId: string) {
  return getStudentsOrderedForScope({ kind: "institute", instituteId });
}

const parentDashboardStudentSelect = {
  id: true,
  fullName: true,
  batchId: true,
  batch: {
    select: {
      name: true,
      branch: { select: { name: true } },
    },
  },
} as const;

export type ParentDashboardStudent = {
  id: string;
  fullName: string;
  batchId: string | null;
  batch: { name: string | null; branch: { name: string } | null } | null;
};

/** Linked children for a parent account (tenant-scoped). */
export async function getStudentsForParentUser(
  userId: string,
  instituteId: string,
): Promise<ParentDashboardStudent[]> {
  return prisma.student.findMany({
    where: {
      AND: [
        { parentUserId: userId, instituteId },
        operationalStudentWhereInput(instituteId),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: parentDashboardStudentSelect,
  });
}

const studentDetailInclude = {
  ...studentBatchInclude,
  parent: { select: { id: true, email: true } },
} as const;

export async function getStudentByIdWithBatch(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: studentDetailInclude,
  });
}

/** Student detail where list/detail scope matches {@link buildStudentScopeWhere} (staff + parent-safe shape). */
export async function getStudentByIdWithBatchForUser(
  user: SessionUserWithInstitute,
  id: string,
) {
  if (typeof id !== "string") return null;
  const studentId = id.trim();
  if (!studentId) return null;
  const scope = await buildStudentScopeWhere(user);
  const row = await prisma.student.findFirst({
    where: { AND: [scope, { id: studentId }] },
    include: studentDetailInclude,
  });
  if (row) return row;

  const baseWhere =
    user.role === ROLE_PARENT
      ? { id: studentId, instituteId: user.instituteId, parentUserId: user.id }
      : { id: studentId, instituteId: user.instituteId };

  const raw = await prisma.student.findFirst({
    where: baseWhere,
    include: {
      ...studentDetailInclude,
      batch: {
        select: {
          id: true,
          name: true,
          instituteId: true,
          branchId: true,
          branch: { select: { instituteId: true } },
        },
      },
    },
  });
  if (!raw) return null;

  if (!studentRecordOperationallyValid(raw)) {
    logTenantIntegrityGuardrail({
      entityType: "Student",
      recordId: raw.id,
      instituteId: user.instituteId,
      reason: "excluded_by_operational_guardrail",
    });
  }
  return null;
}

export async function setStudentBatchAssignment(studentId: string, batchId: string | null) {
  if (batchId === null) {
    return prisma.student.update({
      where: { id: studentId },
      data: { batchId: null },
      include: studentBatchInclude,
    });
  }
  const [student, batch] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { instituteId: true },
    }),
    prisma.batch.findUnique({
      where: { id: batchId },
      select: { instituteId: true, branchId: true },
    }),
  ]);
  if (!student?.instituteId || !batch?.instituteId) {
    throw new Error("STUDENT_OR_BATCH_NOT_FOUND");
  }
  if (student.instituteId !== batch.instituteId) {
    throw new Error("STUDENT_BATCH_INSTITUTE_MISMATCH");
  }
  const branchOk = assertBatchHasBranchId(batch.branchId);
  if (!branchOk.ok) {
    throw new Error("BATCH_BRANCH_REQUIRED");
  }
  return prisma.student.update({
    where: { id: studentId },
    data: {
      batchId,
      instituteId: batch.instituteId,
    },
    include: studentBatchInclude,
  });
}
