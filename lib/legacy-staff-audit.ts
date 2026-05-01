import { prisma } from "@/lib/prisma";
import { ROLE_HEAD_COACH, APP_STAFF_ROLES } from "@/lib/roles";

function isActiveBatchStatus(status: string | null | undefined): boolean {
  return (status ?? "").toUpperCase() === "ACTIVE";
}

function normId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export type LegacyStaffIssue =
  | "missing_institute_id"
  | "missing_branch_id_required"
  | "branch_not_found"
  | "branch_wrong_institute"
  | "head_coach_branch_zero_active_batches"
  | "head_coach_branch_zero_students";

export type LegacyStaffAuditRow = {
  userId: string;
  email: string;
  role: string;
  instituteId: string | null;
  branchId: string | null;
  issues: LegacyStaffIssue[];
};

type HeadCoachBranchCounts = {
  activeBatchCount: number;
  studentCount: number;
};

async function headCoachBranchCounts(
  instituteId: string,
  branchId: string,
): Promise<HeadCoachBranchCounts> {
  const batches = await prisma.batch.findMany({
    where: { instituteId, branchId },
    select: { status: true },
  });
  const activeBatchCount = batches.filter((b) => isActiveBatchStatus(b.status)).length;
  const studentCount = await prisma.student.count({
    where: {
      instituteId,
      batch: { instituteId, branchId },
    },
  });
  return { activeBatchCount, studentCount };
}

function collectLinkageIssues(
  role: string,
  instituteId: string | null,
  branchId: string | null,
  branchRow: { instituteId: string | null } | undefined,
  headCoachCounts: HeadCoachBranchCounts | undefined,
): LegacyStaffIssue[] {
  const issues: LegacyStaffIssue[] = [];
  const inst = normId(instituteId);
  const brId = normId(branchId);

  if (!inst) {
    issues.push("missing_institute_id");
  }

  if (role === ROLE_HEAD_COACH && !brId) {
    issues.push("missing_branch_id_required");
  }

  if (brId) {
    if (!branchRow) {
      issues.push("branch_not_found");
    } else {
      const bInst = normId(branchRow.instituteId);
      if (inst && bInst && bInst !== inst) {
        issues.push("branch_wrong_institute");
      }
      if (inst && !bInst) {
        issues.push("branch_wrong_institute");
      }
    }
  }

  if (
    role === ROLE_HEAD_COACH &&
    inst &&
    brId &&
    branchRow &&
    normId(branchRow.instituteId) === inst &&
    headCoachCounts
  ) {
    if (headCoachCounts.activeBatchCount === 0) {
      issues.push("head_coach_branch_zero_active_batches");
    }
    if (headCoachCounts.studentCount === 0) {
      issues.push("head_coach_branch_zero_students");
    }
  }

  return issues;
}

/**
 * Staff accounts (admin, head_coach, assistant_coach) with incomplete or inconsistent
 * tenant / branch linkage. Read-only; does not change auth.
 */
export async function auditLegacyStaffAccounts(): Promise<LegacyStaffAuditRow[]> {
  const users = await prisma.user.findMany({
    where: { role: { in: [...APP_STAFF_ROLES] } },
    select: {
      id: true,
      email: true,
      role: true,
      instituteId: true,
      branchId: true,
    },
  });

  const branchIds = [
    ...new Set(
      users
        .map((u) => normId(u.branchId))
        .filter((x): x is string => x !== null),
    ),
  ];

  const branches =
    branchIds.length > 0
      ? await prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, instituteId: true },
        })
      : [];

  const branchMap = new Map(branches.map((b) => [b.id, b]));

  const countCache = new Map<string, HeadCoachBranchCounts>();

  const rows: LegacyStaffAuditRow[] = [];

  for (const u of users) {
    const brId = normId(u.branchId);
    const inst = normId(u.instituteId);
    const branchRow = brId ? branchMap.get(brId) : undefined;

    let headCoachCounts: HeadCoachBranchCounts | undefined;
    if (
      u.role === ROLE_HEAD_COACH &&
      inst &&
      brId &&
      branchRow &&
      normId(branchRow.instituteId) === inst
    ) {
      const key = `${inst}::${brId}`;
      let c = countCache.get(key);
      if (!c) {
        c = await headCoachBranchCounts(inst, brId);
        countCache.set(key, c);
      }
      headCoachCounts = c;
    }

    const issues = collectLinkageIssues(
      u.role,
      u.instituteId,
      u.branchId,
      branchRow,
      headCoachCounts,
    );

    if (issues.length > 0) {
      rows.push({
        userId: u.id,
        email: u.email,
        role: u.role,
        instituteId: normId(u.instituteId),
        branchId: brId,
        issues,
      });
    }
  }

  return rows;
}

export type FocusedStaffTenantAudit = {
  userId: string;
  /** Display label (User has no separate name field; email is used). */
  name: string;
  role: string | null;
  instituteId: string | null;
  branchId: string | null;
  branchExists: boolean;
  /** `null` when not applicable (e.g. no branch id). */
  branchBelongsToSameInstitute: boolean | null;
  activeBatchCountInBranch: number;
  studentCountThroughBranchBatches: number;
  issues: LegacyStaffIssue[];
};

/**
 * Focused tenant/branch linkage audit for one user (read-only).
 */
export async function auditStaffUserTenantLinkage(
  userId: string,
): Promise<FocusedStaffTenantAudit | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      instituteId: true,
      branchId: true,
    },
  });
  if (!user) return null;

  const instituteId = normId(user.instituteId);
  const branchId = normId(user.branchId);

  let branchRow: { instituteId: string | null } | undefined;
  if (branchId) {
    branchRow =
      (await prisma.branch.findUnique({
        where: { id: branchId },
        select: { instituteId: true },
      })) ?? undefined;
  }

  const branchExists = Boolean(branchRow);
  let branchBelongsToSameInstitute: boolean | null = null;
  if (!branchId || !instituteId) {
    branchBelongsToSameInstitute = null;
  } else if (!branchRow) {
    branchBelongsToSameInstitute = false;
  } else {
    const bInst = normId(branchRow.instituteId);
    if (!bInst) {
      branchBelongsToSameInstitute = false;
    } else {
      branchBelongsToSameInstitute = bInst === instituteId;
    }
  }

  let activeBatchCountInBranch = 0;
  let studentCountThroughBranchBatches = 0;
  if (
    instituteId &&
    branchId &&
    branchBelongsToSameInstitute === true
  ) {
    const c = await headCoachBranchCounts(instituteId, branchId);
    activeBatchCountInBranch = c.activeBatchCount;
    studentCountThroughBranchBatches = c.studentCount;
  }

  const headCoachCountsForIssues =
    user.role === ROLE_HEAD_COACH &&
    instituteId &&
    branchId &&
    branchBelongsToSameInstitute === true
      ? {
          activeBatchCount: activeBatchCountInBranch,
          studentCount: studentCountThroughBranchBatches,
        }
      : undefined;

  const issues = collectLinkageIssues(
    user.role,
    user.instituteId,
    user.branchId,
    branchRow,
    headCoachCountsForIssues,
  );

  return {
    userId: user.id,
    name: user.email,
    role: user.role,
    instituteId,
    branchId,
    branchExists,
    branchBelongsToSameInstitute,
    activeBatchCountInBranch,
    studentCountThroughBranchBatches,
    issues,
  };
}
