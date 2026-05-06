import type { Prisma } from "@prisma/client";
import { branchLocationDisplayLabel } from "@/lib/branch-display-label";
import { prisma } from "@/lib/prisma";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  ROLE_PARENT,
  ROLE_SUPER_ADMIN,
} from "@/lib/roles";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type PlatformSupportUserRow = {
  id: string;
  email: string;
  role: string;
  instituteId: string | null;
  instituteName: string | null;
  branchId: string | null;
  branchName: string | null;
  assistantBatchCount: number;
  parentLinkedStudentCount: number;
  createdAt: string | null;
  scopeSummary: string;
};

export type PlatformSupportInviteStatus = "pending" | "expired" | "used";

export type PlatformSupportInviteRow = {
  id: string;
  email: string | null;
  role: string;
  instituteId: string | null;
  instituteName: string | null;
  branchId: string | null;
  branchName: string | null;
  studentId: string | null;
  studentLabel: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  status: PlatformSupportInviteStatus;
  createdAt: string | null;
};

export type PlatformParentLinkStatus =
  | "linked"
  | "missing_parent"
  | "parent_missing_institute"
  | "institute_mismatch";

export type PlatformParentLinkRow = {
  studentId: string;
  studentLabel: string;
  studentInstituteId: string | null;
  studentInstituteName: string | null;
  parentUserId: string | null;
  parentEmail: string | null;
  parentInstituteId: string | null;
  parentInstituteName: string | null;
  linkStatus: PlatformParentLinkStatus;
  issueSummary: string | null;
};

function clampLimit(raw: string | null, fallback: number): number {
  const n = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, MAX_LIMIT);
}

export function parseSupportLimit(
  raw: string | null,
  fallback: number = DEFAULT_LIMIT,
): number {
  return clampLimit(raw, fallback);
}

function inviteStatus(now: Date, usedAt: Date | null, expiresAt: Date): PlatformSupportInviteStatus {
  if (usedAt) return "used";
  if (expiresAt > now) return "pending";
  return "expired";
}

function uniqueAssistantBranchLabels(
  assignments: Array<{
    batch: {
      branch: { name: string } | null;
      institute: { name: string } | null;
    } | null;
  }>,
): string[] {
  const set = new Set<string>();
  for (const a of assignments) {
    const raw = a.batch?.branch?.name;
    if (!raw?.trim()) continue;
    const inst = a.batch?.institute?.name ?? null;
    const label = branchLocationDisplayLabel(inst, raw);
    if (label) set.add(label);
  }
  return [...set].sort((x, y) => x.localeCompare(y));
}

function scopeSummaryForUser(args: {
  role: string;
  instituteId: string | null;
  branchId: string | null;
  branchName: string | null;
  branchMissing: boolean;
  assistantBatchCount: number;
  assistantBranchLabels: string[];
  parentLinkedStudentCount: number;
}): string {
  const {
    role,
    instituteId,
    branchId,
    branchName,
    branchMissing,
    assistantBatchCount,
    assistantBranchLabels,
    parentLinkedStudentCount,
  } = args;

  switch (role) {
    case ROLE_SUPER_ADMIN:
      return "Platform user";
    case ROLE_ADMIN:
      return instituteId ? "Institute admin" : "Missing expected institute scope";
    case ROLE_HEAD_COACH:
      if (!instituteId) return "Missing expected institute scope";
      if (!branchId || branchMissing) return "Missing expected branch scope";
      return branchName?.trim()
        ? `Head coach scoped to branch: ${branchName.trim()}`
        : "Head coach scoped to branch: (unnamed)";
    case ROLE_ASSISTANT_COACH: {
      if (!instituteId) return "Missing expected institute scope";
      const base = `Assistant coach assigned to ${assistantBatchCount} batch(es)`;
      if (assistantBranchLabels.length === 0) return base;
      return `${base}; branches: ${assistantBranchLabels.join(", ")}`;
    }
    case ROLE_PARENT:
      return `Parent linked to ${parentLinkedStudentCount} student(s)`;
    default:
      return instituteId ? "Tenant user" : "Missing expected institute scope";
  }
}

export type GetPlatformSupportUsersParams = {
  instituteId?: string | null;
  role?: string | null;
  q?: string | null;
  limit?: number;
};

export async function getPlatformSupportUsers(
  params: GetPlatformSupportUsersParams = {},
): Promise<{ users: PlatformSupportUserRow[] }> {
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, params.limit ?? DEFAULT_LIMIT),
  );

  const where: Prisma.UserWhereInput = {};

  if (params.instituteId?.trim()) {
    where.instituteId = params.instituteId.trim();
  }
  if (params.role?.trim()) {
    where.role = params.role.trim();
  }
  const q = params.q?.trim();
  if (q) {
    where.email = { contains: q };
  }

  const rows = await prisma.user.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      instituteId: true,
      branchId: true,
      createdAt: true,
      institute: { select: { name: true } },
      branch: { select: { name: true } },
      assistantAssignments: {
        select: {
          batch: {
            select: {
              branch: { select: { name: true } },
              institute: { select: { name: true } },
            },
          },
        },
      },
      _count: {
        select: {
          assistantAssignments: true,
          students: true,
        },
      },
    },
  });

  const users: PlatformSupportUserRow[] = rows.map((u) => {
    const branchMissing = Boolean(u.branchId && !u.branch);
    const instituteName = u.institute?.name ?? null;
    const branchName = branchLocationDisplayLabel(
      instituteName,
      u.branch?.name ?? null,
    );
    const assistantBatchCount = u._count.assistantAssignments;
    const assistantBranchLabels =
      u.role === ROLE_ASSISTANT_COACH
        ? uniqueAssistantBranchLabels(u.assistantAssignments)
        : [];
    const parentLinkedStudentCount = u._count.students;

    return {
      id: u.id,
      email: u.email,
      role: u.role,
      instituteId: u.instituteId,
      instituteName,
      branchId: u.branchId,
      branchName,
      assistantBatchCount,
      parentLinkedStudentCount,
      createdAt: u.createdAt?.toISOString() ?? null,
      scopeSummary: scopeSummaryForUser({
        role: u.role,
        instituteId: u.instituteId,
        branchId: u.branchId,
        branchName,
        branchMissing,
        assistantBatchCount,
        assistantBranchLabels,
        parentLinkedStudentCount,
      }),
    };
  });

  return { users };
}

export type GetPlatformSupportInvitesParams = {
  instituteId?: string | null;
  role?: string | null;
  status?: PlatformSupportInviteStatus | null;
  limit?: number;
};

export async function getPlatformSupportInvites(
  params: GetPlatformSupportInvitesParams = {},
): Promise<{ invites: PlatformSupportInviteRow[] }> {
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, params.limit ?? DEFAULT_LIMIT),
  );
  const now = new Date();

  const where: Prisma.InviteWhereInput = {};

  if (params.instituteId?.trim()) {
    where.instituteId = params.instituteId.trim();
  }
  if (params.role?.trim()) {
    where.role = params.role.trim();
  }

  if (params.status === "pending") {
    where.usedAt = null;
    where.expiresAt = { gt: now };
  } else if (params.status === "expired") {
    where.usedAt = null;
    where.expiresAt = { lte: now };
  } else if (params.status === "used") {
    where.usedAt = { not: null };
  }

  const rows = await prisma.invite.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      instituteId: true,
      branchId: true,
      studentId: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
      institute: { select: { name: true } },
      branch: { select: { name: true } },
      student: { select: { id: true, fullName: true } },
    },
  });

  const invites: PlatformSupportInviteRow[] = rows.map((inv) => {
    const status = inviteStatus(now, inv.usedAt, inv.expiresAt);
    const st = inv.student;
    const studentLabel = st
      ? st.fullName?.trim() || st.id
      : inv.studentId;

    return {
      id: inv.id,
      email: inv.email?.trim() || null,
      role: inv.role,
      instituteId: inv.instituteId,
      instituteName: inv.institute?.name ?? null,
      branchId: inv.branchId,
      branchName: inv.branch?.name ?? null,
      studentId: inv.studentId,
      studentLabel: studentLabel ?? null,
      expiresAt: inv.expiresAt?.toISOString() ?? null,
      acceptedAt: inv.usedAt?.toISOString() ?? null,
      status,
      createdAt: inv.createdAt?.toISOString() ?? null,
    };
  });

  return { invites };
}

function studentLinkRow(
  s: {
    id: string;
    fullName: string;
    instituteId: string | null;
    parentUserId: string | null;
    parent: {
      id: string;
      email: string;
      instituteId: string | null;
    } | null;
  },
  instituteName: string | null,
  parentInstituteName: string | null,
): PlatformParentLinkRow {
  const studentLabel = s.fullName?.trim() || s.id;

  if (!s.parentUserId || !s.parent) {
    return {
      studentId: s.id,
      studentLabel,
      studentInstituteId: s.instituteId,
      studentInstituteName: instituteName,
      parentUserId: s.parentUserId,
      parentEmail: null,
      parentInstituteId: null,
      parentInstituteName: null,
      linkStatus: "missing_parent",
      issueSummary: s.parentUserId
        ? "Linked parent user record not found."
        : "No parent user linked.",
    };
  }

  const p = s.parent;
  const pInst = p.instituteId?.trim() || null;
  const sInst = s.instituteId?.trim() || null;

  if (!pInst) {
    return {
      studentId: s.id,
      studentLabel,
      studentInstituteId: s.instituteId,
      studentInstituteName: instituteName,
      parentUserId: p.id,
      parentEmail: p.email,
      parentInstituteId: p.instituteId,
      parentInstituteName: parentInstituteName,
      linkStatus: "parent_missing_institute",
      issueSummary: "Parent account has no institute scope.",
    };
  }

  if (sInst && pInst && sInst !== pInst) {
    return {
      studentId: s.id,
      studentLabel,
      studentInstituteId: s.instituteId,
      studentInstituteName: instituteName,
      parentUserId: p.id,
      parentEmail: p.email,
      parentInstituteId: p.instituteId,
      parentInstituteName: parentInstituteName,
      linkStatus: "institute_mismatch",
      issueSummary: "Parent and student institutes do not match.",
    };
  }

  let issueSummary: string | null = null;
  if (!sInst && pInst) {
    issueSummary = "Student has no institute scope; parent is scoped.";
  } else if (sInst && !pInst) {
    issueSummary = "Parent has no institute scope.";
  }

  return {
    studentId: s.id,
    studentLabel,
    studentInstituteId: s.instituteId,
    studentInstituteName: instituteName,
    parentUserId: p.id,
    parentEmail: p.email,
    parentInstituteId: p.instituteId,
    parentInstituteName: parentInstituteName,
    linkStatus: "linked",
    issueSummary,
  };
}

export type GetPlatformParentLinksParams = {
  instituteId?: string | null;
  parentEmail?: string | null;
  studentId?: string | null;
  limit?: number;
};

export async function getPlatformParentLinks(
  params: GetPlatformParentLinksParams = {},
): Promise<{ links: PlatformParentLinkRow[] }> {
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, params.limit ?? DEFAULT_LIMIT),
  );

  const where: Prisma.StudentWhereInput = {};

  if (params.instituteId?.trim()) {
    where.instituteId = params.instituteId.trim();
  }
  if (params.studentId?.trim()) {
    where.id = params.studentId.trim();
  }
  const pe = params.parentEmail?.trim();
  if (pe) {
    where.parent = { is: { email: { contains: pe } } };
  }

  const rows = await prisma.student.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      fullName: true,
      instituteId: true,
      parentUserId: true,
      institute: { select: { name: true } },
      parent: {
        select: {
          id: true,
          email: true,
          instituteId: true,
          institute: { select: { name: true } },
        },
      },
    },
  });

  const links = rows.map((s) =>
    studentLinkRow(
      {
        id: s.id,
        fullName: s.fullName,
        instituteId: s.instituteId,
        parentUserId: s.parentUserId,
        parent: s.parent
          ? {
              id: s.parent.id,
              email: s.parent.email,
              instituteId: s.parent.instituteId,
            }
          : null,
      },
      s.institute?.name ?? null,
      s.parent?.institute?.name ?? null,
    ),
  );

  return { links };
}
