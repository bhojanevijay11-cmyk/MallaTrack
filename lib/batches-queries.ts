import type { Prisma } from "@prisma/client";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { buildBatchScopeWhere } from "@/lib/authz-prisma-scopes";
import { prisma } from "@/lib/prisma";
import { ROLE_PARENT } from "@/lib/roles";
import { resolveBranchHeadCoachLabel } from "@/lib/branch-head-coach";
import { headCoachBatchWhereInput } from "@/lib/head-coach-scope";
import { staffUserLabel } from "@/lib/staff-user-label";
import {
  batchRecordOperationallyValid,
  operationalBatchWhereInput,
} from "@/lib/tenant-integrity-guardrails";
import { logTenantIntegrityGuardrail } from "@/lib/tenant-integrity-log";

export type BatchStatusValue = "ACTIVE" | "INACTIVE";

const batchStudentCount = {
  _count: { select: { students: true } },
} as const;

const batchCoachSelect = {
  coach: { select: { id: true, fullName: true, status: true } },
} as const;

const batchBranchSelect = {
  branch: { select: { name: true } },
} as const;

const staffUserInviteSelect = {
  invitesReceived: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { fullName: true },
  },
} as const;

const batchAssistantInclude = {
  assistantAssignments: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          ...staffUserInviteSelect,
        },
      },
    },
  },
} as const;

export type BatchesListScope =
  | { kind: "institute"; instituteId: string }
  | { kind: "branch"; branchId: string; instituteId: string }
  | { kind: "head_coach"; branchId: string | null; instituteId: string }
  | { kind: "assistant"; userId: string; instituteId: string };

/**
 * Single source for listing batches (newest first). Used by GET /api/batches and the admin dashboard.
 */
export async function getBatchesOrderedByCreatedDesc(scope: BatchesListScope) {
  const op = operationalBatchWhereInput(scope.instituteId);
  let where: Prisma.BatchWhereInput;
  if (scope.kind === "institute") {
    where = { AND: [{ instituteId: scope.instituteId }, op] };
  } else if (scope.kind === "branch") {
    where = {
      AND: [{ instituteId: scope.instituteId, branchId: scope.branchId }, op],
    };
  } else if (scope.kind === "head_coach") {
    where = { AND: [headCoachBatchWhereInput(scope.branchId, scope.instituteId), op] };
  } else {
    where = {
      AND: [
        {
          instituteId: scope.instituteId,
          assistantAssignments: { some: { userId: scope.userId } },
        },
        op,
      ],
    };
  }
  return prisma.batch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      ...batchStudentCount,
      ...batchCoachSelect,
      ...batchBranchSelect,
      ...batchAssistantInclude,
    },
  });
}

const batchDetailInclude = {
  ...batchStudentCount,
  ...batchCoachSelect,
  ...batchBranchSelect,
  ...batchAssistantInclude,
  students: {
    orderBy: { fullName: "asc" as const },
    select: { id: true, fullName: true, status: true },
  },
} as const;

export async function getBatchByIdWithStudents(id: string) {
  return prisma.batch.findUnique({
    where: { id },
    include: batchDetailInclude,
  });
}

/** Batch detail + roster where caller matches {@link buildBatchScopeWhere} (parity with list APIs). */
export async function getBatchByIdWithStudentsForUser(
  user: SessionUserWithInstitute,
  id: string,
) {
  const scope = await buildBatchScopeWhere(user);
  const row = await prisma.batch.findFirst({
    where: { AND: [scope, { id }] },
    include: batchDetailInclude,
  });
  if (row) return row;

  if (user.role === ROLE_PARENT) {
    return null;
  }

  const raw = await prisma.batch.findFirst({
    where: { id, instituteId: user.instituteId },
    include: {
      ...batchDetailInclude,
      branch: { select: { name: true, instituteId: true } },
    },
  });
  if (!raw) return null;

  if (!batchRecordOperationallyValid(raw)) {
    logTenantIntegrityGuardrail({
      entityType: "Batch",
      recordId: raw.id,
      instituteId: user.instituteId,
      reason: "excluded_by_operational_guardrail",
    });
  }
  return null;
}

export function parseBatchStatus(value: unknown): BatchStatusValue {
  if (typeof value === "string" && value.trim().toUpperCase() === "INACTIVE") {
    return "INACTIVE";
  }
  return "ACTIVE";
}

/** For updates: only accepts explicit ACTIVE or INACTIVE. */
export function parseBatchStatusStrict(value: unknown): BatchStatusValue | null {
  if (typeof value !== "string") return null;
  const u = value.trim().toUpperCase();
  if (u === "ACTIVE") return "ACTIVE";
  if (u === "INACTIVE") return "INACTIVE";
  return null;
}

export async function createBatch(input: {
  name: string;
  status: BatchStatusValue;
  startTime?: string | null;
  endTime?: string | null;
  branchId: string | null;
  instituteId: string;
}) {
  const data: {
    name: string;
    status: BatchStatusValue;
    startTime?: string;
    endTime?: string;
    branchId: string | null;
    instituteId: string;
  } = {
    name: input.name,
    status: input.status,
    branchId: input.branchId,
    instituteId: input.instituteId,
  };
  if (input.startTime != null && input.endTime != null) {
    data.startTime = input.startTime;
    data.endTime = input.endTime;
  }

  return prisma.batch.create({
    data,
    include: {
      ...batchStudentCount,
      ...batchCoachSelect,
      ...batchBranchSelect,
      ...batchAssistantInclude,
    },
  });
}

export async function updateBatchCoach(
  batchId: string,
  coachId: string | null,
  instituteId: string,
) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, instituteId },
    select: { id: true },
  });
  if (!batch) return null;

  if (coachId !== null) {
    const coach = await prisma.coach.findFirst({
      where: { id: coachId, instituteId },
    });
    if (!coach) {
      return null;
    }
  }
  try {
    return await prisma.batch.update({
      where: { id: batchId },
      data: { coachId },
      include: {
        ...batchStudentCount,
        ...batchCoachSelect,
        ...batchBranchSelect,
        ...batchAssistantInclude,
      },
    });
  } catch {
    return null;
  }
}

export async function updateBatchStatus(id: string, status: BatchStatusValue) {
  return prisma.batch.update({
    where: { id },
    data: { status },
    include: {
      ...batchStudentCount,
      ...batchCoachSelect,
      ...batchBranchSelect,
      ...batchAssistantInclude,
    },
  });
}

export async function updateBatchFields(
  id: string,
  data: {
    name: string | null;
    status: BatchStatusValue;
    startTime: string | null;
    endTime: string | null;
    /** When set (including `null`), updates `Batch.branchId`. Omit to leave unchanged. */
    branchId?: string | null;
  },
) {
  const { branchId, ...rest } = data;
  return prisma.batch.update({
    where: { id },
    data: {
      ...rest,
      ...(branchId !== undefined ? { branchId } : {}),
    },
    include: {
      ...batchStudentCount,
      ...batchCoachSelect,
      ...batchBranchSelect,
      ...batchAssistantInclude,
    },
  });
}

/** JSON shape for batch list/detail APIs (counts assigned students). */
export function toBatchApiRecord(
  batch: {
    id: string;
    name: string | null;
    status: string;
    startTime: string | null;
    endTime: string | null;
    coachId: string | null;
    branchId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { students: number };
    coach?: { id: string; fullName: string; status: string } | null;
    branch?: { name: string } | null;
    assistantAssignments?: {
      user: {
        id: string;
        email: string;
        invitesReceived: { fullName: string }[];
      };
    }[];
  },
  options?: { branchHeadCoachLabel?: string | null },
) {
  const assistantCoaches = (batch.assistantAssignments ?? []).map((a) => ({
    userId: a.user.id,
    label: staffUserLabel(a.user),
  }));
  return {
    id: batch.id,
    name: batch.name,
    status: batch.status,
    startTime: batch.startTime,
    endTime: batch.endTime,
    branchId: batch.branchId ?? null,
    branchName: batch.branch?.name?.trim() ? batch.branch.name.trim() : null,
    coachId: batch.coachId ?? null,
    coach: batch.coach
      ? {
          id: batch.coach.id,
          fullName: batch.coach.fullName,
          status: batch.coach.status,
        }
      : null,
    branchHeadCoachLabel: options?.branchHeadCoachLabel ?? null,
    assistantCoaches,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    studentCount: batch._count.students,
  };
}

type BatchForApi = Parameters<typeof toBatchApiRecord>[0] & {
  instituteId?: string | null;
};

/** Resolves branch head coach display label and merges into the batch API record. */
export async function toBatchApiRecordWithHeadCoach(batch: BatchForApi) {
  const branchHeadCoachLabel = await resolveBranchHeadCoachLabel(
    batch.instituteId ?? null,
    batch.branchId ?? null,
  );
  return toBatchApiRecord(batch, { branchHeadCoachLabel });
}
