import { branchLocationDisplayLabel } from "@/lib/branch-display-label";
import { prisma } from "@/lib/prisma";
import type { InstituteStatus } from "@/lib/institute-status";
import { normalizeInstituteStatus } from "@/lib/institute-status";
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

function toIso(d: Date | null | undefined): string | null {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export type PlatformInstituteListItem = {
  id: string;
  name: string;
  status: InstituteStatus;
  createdAt: string | null;
  updatedAt: string | null;
  adminCount: number;
  headCoachCount: number;
  assistantCoachCount: number;
  parentCount: number;
  branchCount: number;
  batchCount: number;
  studentCount: number;
};

export type PlatformInstituteDetail = {
  institute: {
    id: string;
    name: string;
    status: InstituteStatus;
    createdAt: string | null;
    updatedAt: string | null;
    counts: {
      admins: number;
      headCoaches: number;
      assistantCoaches: number;
      parents: number;
      /** Head coach + assistant coach user accounts for this institute. */
      staffUsersTotal: number;
      branches: number;
      studentsTotal: number;
      studentsActive: number;
      studentsInactive: number;
      /** Same filter as the Admin Students list / student KPI denominator (operational linkage). */
      studentsOperationalRoster: number;
      batchesTotal: number;
      batchesActive: number;
      batchesInactive: number;
      /** Same filter as the Admin “Total active batches” KPI (ACTIVE + valid branch linkage). */
      batchesActiveOperational: number;
      invitesTotal: number;
      invitesPending: number;
    };
    admins: Array<{
      id: string;
      name: string | null;
      email: string;
      createdAt: string | null;
    }>;
    branches: Array<{
      id: string;
      name: string;
      batchCount: number;
      studentCount: number;
    }>;
  };
};

type RoleCountMap = Partial<Record<string, number>>;

function buildRoleCountMap(
  rows: Array<{
    instituteId: string | null;
    role: string;
    _count: { _all: number };
  }>,
): Map<string, RoleCountMap> {
  const map = new Map<string, RoleCountMap>();
  for (const row of rows) {
    if (!row.instituteId) continue;
    const cur = map.get(row.instituteId) ?? {};
    cur[row.role] = row._count._all;
    map.set(row.instituteId, cur);
  }
  return map;
}

function buildSingleCountMap(
  rows: Array<{ instituteId: string | null; _count: { _all: number } }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.instituteId) continue;
    map.set(row.instituteId, row._count._all);
  }
  return map;
}

export async function getPlatformInstituteSummaries(): Promise<
  PlatformInstituteListItem[]
> {
  const institutes = await prisma.institute.findMany({
    select: { id: true, name: true, status: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  const [userBuckets, branchBuckets, batchBuckets, studentBuckets] =
    await Promise.all([
      prisma.user.groupBy({
        by: ["instituteId", "role"],
        where: { instituteId: { not: null } },
        _count: { _all: true },
      }),
      prisma.branch.groupBy({
        by: ["instituteId"],
        where: { instituteId: { not: null } },
        _count: { _all: true },
      }),
      prisma.batch.groupBy({
        by: ["instituteId"],
        where: { instituteId: { not: null } },
        _count: { _all: true },
      }),
      prisma.student.groupBy({
        by: ["instituteId"],
        where: { instituteId: { not: null } },
        _count: { _all: true },
      }),
    ]);

  const userMap = buildRoleCountMap(userBuckets);
  const branchMap = buildSingleCountMap(branchBuckets);
  const batchMap = buildSingleCountMap(batchBuckets);
  const studentMap = buildSingleCountMap(studentBuckets);

  return institutes.map((inst) => {
    const roles = userMap.get(inst.id) ?? {};
    return {
      id: inst.id,
      name: inst.name,
      status: normalizeInstituteStatus(inst.status),
      createdAt: toIso(inst.createdAt),
      updatedAt: null,
      adminCount: roles[ROLE_ADMIN] ?? 0,
      headCoachCount: roles[ROLE_HEAD_COACH] ?? 0,
      assistantCoachCount: roles[ROLE_ASSISTANT_COACH] ?? 0,
      parentCount: roles[ROLE_PARENT] ?? 0,
      branchCount: branchMap.get(inst.id) ?? 0,
      batchCount: batchMap.get(inst.id) ?? 0,
      studentCount: studentMap.get(inst.id) ?? 0,
    };
  });
}

export async function getPlatformInstituteDetail(
  instituteId: string,
): Promise<PlatformInstituteDetail | null> {
  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
    select: { id: true, name: true, status: true, createdAt: true },
  });

  if (!institute) return null;

  const opStudent = operationalStudentWhereInput(instituteId);
  const opBatch = operationalBatchWhereInput(instituteId);

  const [
    userRoleRows,
    branchCount,
    batchesTotal,
    batchesActive,
    batchesActiveOperational,
    studentsTotal,
    studentsActive,
    studentsOperationalRoster,
    invitesTotal,
    invitesPending,
    adminRows,
    branches,
    batchCountsByBranch,
    studentByBatch,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      where: { instituteId },
      _count: { _all: true },
    }),
    prisma.branch.count({ where: { instituteId } }),
    prisma.batch.count({ where: { instituteId } }),
    prisma.batch.count({ where: { instituteId, status: "ACTIVE" } }),
    prisma.batch.count({
      where: { AND: [{ instituteId }, opBatch, { status: "ACTIVE" }] },
    }),
    prisma.student.count({ where: { instituteId } }),
    prisma.student.count({ where: { instituteId, status: "ACTIVE" } }),
    prisma.student.count({ where: { AND: [{ instituteId }, opStudent] } }),
    prisma.invite.count({ where: { instituteId } }),
    prisma.invite.count({ where: { instituteId, usedAt: null } }),
    prisma.user.findMany({
      where: { instituteId, role: ROLE_ADMIN },
      select: { id: true, email: true, createdAt: true },
      orderBy: { email: "asc" },
    }),
    prisma.branch.findMany({
      where: { instituteId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.batch.groupBy({
      by: ["branchId"],
      where: { instituteId, branchId: { not: null } },
      _count: { _all: true },
    }),
    prisma.student.groupBy({
      by: ["batchId"],
      where: { instituteId, batchId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const roleToCount: RoleCountMap = {};
  for (const row of userRoleRows) {
    roleToCount[row.role] = row._count._all;
  }

  const studentsInactive = Math.max(0, studentsTotal - studentsActive);
  const batchesInactive = Math.max(0, batchesTotal - batchesActive);
  const headCoachUsers = roleToCount[ROLE_HEAD_COACH] ?? 0;
  const assistantCoachUsers = roleToCount[ROLE_ASSISTANT_COACH] ?? 0;

  const batchesPerBranch = new Map<string, number>();
  for (const row of batchCountsByBranch) {
    if (row.branchId) batchesPerBranch.set(row.branchId, row._count._all);
  }

  const batchIdsFromStudents = [
    ...new Set(
      studentByBatch
        .map((r) => r.batchId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  const batchBranchLinks =
    batchIdsFromStudents.length === 0
      ? []
      : await prisma.batch.findMany({
          where: { instituteId, id: { in: batchIdsFromStudents } },
          select: { id: true, branchId: true },
        });

  const batchToBranch = new Map(
    batchBranchLinks.map((b) => [b.id, b.branchId] as const),
  );

  const studentsPerBranch = new Map<string, number>();
  for (const row of studentByBatch) {
    const bid = row.batchId;
    if (!bid) continue;
    const brId = batchToBranch.get(bid);
    if (!brId) continue;
    const add = row._count._all;
    studentsPerBranch.set(brId, (studentsPerBranch.get(brId) ?? 0) + add);
  }

  return {
    institute: {
      id: institute.id,
      name: institute.name,
      status: normalizeInstituteStatus(institute.status),
      createdAt: toIso(institute.createdAt),
      updatedAt: null,
      counts: {
        admins: roleToCount[ROLE_ADMIN] ?? 0,
        headCoaches: headCoachUsers,
        assistantCoaches: assistantCoachUsers,
        parents: roleToCount[ROLE_PARENT] ?? 0,
        staffUsersTotal: headCoachUsers + assistantCoachUsers,
        branches: branchCount,
        studentsTotal,
        studentsActive,
        studentsInactive,
        studentsOperationalRoster,
        batchesTotal,
        batchesActive,
        batchesInactive,
        batchesActiveOperational,
        invitesTotal,
        invitesPending,
      },
      admins: adminRows.map((a) => ({
        id: a.id,
        name: null,
        email: a.email,
        createdAt: toIso(a.createdAt),
      })),
      branches: branches.map((b) => ({
        id: b.id,
        name: branchLocationDisplayLabel(institute.name, b.name) ?? b.name.trim(),
        batchCount: batchesPerBranch.get(b.id) ?? 0,
        studentCount: studentsPerBranch.get(b.id) ?? 0,
      })),
    },
  };
}

/** SUPER_ADMIN repair / health UI: branches for one institute only (id + name). */
export async function getInstituteBranchOptions(
  instituteId: string,
): Promise<Array<{ id: string; name: string }>> {
  const trimmed = instituteId.trim();
  if (!trimmed) return [];

  return prisma.branch.findMany({
    where: { instituteId: trimmed },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
