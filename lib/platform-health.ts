import { prisma } from "@/lib/prisma";
import { ROLE_HEAD_COACH } from "@/lib/roles";

const MAX_ISSUES = 200;

export type PlatformHealthSeverity = "critical" | "warning";

export type PlatformHealthEntityType =
  | "batch"
  | "student"
  | "user"
  | "batch_assistant";

export type PlatformHealthIssue = {
  id: string;
  category: string;
  severity: PlatformHealthSeverity;
  instituteId: string | null;
  instituteName: string | null;
  entityType: PlatformHealthEntityType;
  entityId: string;
  title: string;
  description: string;
  recommendedAction: string;
};

export type PlatformHealthReport = {
  summary: {
    totalIssues: number;
    criticalCount: number;
    warningCount: number;
    checkedAt: string;
  };
  issues: PlatformHealthIssue[];
};

function instituteName(
  instituteId: string | null | undefined,
  nameById: Map<string, string>,
): string | null {
  if (!instituteId) return null;
  return nameById.get(instituteId) ?? null;
}

function severityOrder(s: PlatformHealthSeverity): number {
  return s === "critical" ? 0 : 1;
}

function issueId(category: string, entityId: string): string {
  return `${category}:${entityId}`;
}

function noBranchOrEmpty(): {
  OR: Array<{ branchId: null } | { branchId: string }>;
} {
  return { OR: [{ branchId: null }, { branchId: "" }] };
}

function noBatchOrEmpty(): {
  OR: Array<{ batchId: null } | { batchId: string }>;
} {
  return { OR: [{ batchId: null }, { batchId: "" }] };
}

function branchIdSet() {
  return { branchId: { not: null }, NOT: { branchId: "" } };
}

function batchIdSet() {
  return { batchId: { not: null }, NOT: { batchId: "" } };
}

export async function getPlatformHealthReport(): Promise<PlatformHealthReport> {
  const checkedAt = new Date().toISOString();

  const instituteRows = await prisma.institute.findMany({
    select: { id: true, name: true },
  });
  const nameById = new Map(instituteRows.map((i) => [i.id, i.name]));

  const [
    batchesMissingBranch,
    batchesWithBranch,
    studentsMissingBatch,
    studentsWithBatch,
    headCoachesMissingBranch,
    headCoachesWithBranch,
    assistantsOnBranchlessBatches,
    batchAssistantsWithBatchRef,
    studentsWithParent,
  ] = await Promise.all([
    prisma.batch.findMany({
      where: {
        instituteId: { not: null },
        ...noBranchOrEmpty(),
      },
      select: { id: true, instituteId: true },
    }),
    prisma.batch.findMany({
      where: {
        instituteId: { not: null },
        ...branchIdSet(),
      },
      select: {
        id: true,
        instituteId: true,
        branch: { select: { instituteId: true } },
      },
    }),
    prisma.student.findMany({
      where: {
        instituteId: { not: null },
        ...noBatchOrEmpty(),
      },
      select: { id: true, instituteId: true },
    }),
    prisma.student.findMany({
      where: {
        instituteId: { not: null },
        ...batchIdSet(),
      },
      select: {
        id: true,
        instituteId: true,
        batch: { select: { instituteId: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        role: ROLE_HEAD_COACH,
        instituteId: { not: null },
        ...noBranchOrEmpty(),
      },
      select: { id: true, instituteId: true },
    }),
    prisma.user.findMany({
      where: {
        role: ROLE_HEAD_COACH,
        instituteId: { not: null },
        ...branchIdSet(),
      },
      select: {
        id: true,
        instituteId: true,
        branch: { select: { instituteId: true } },
      },
    }),
    prisma.batchAssistant.findMany({
      where: {
        batch: {
          ...noBranchOrEmpty(),
        },
      },
      select: {
        id: true,
        batchId: true,
        batch: { select: { instituteId: true } },
      },
    }),
    prisma.batchAssistant.findMany({
      select: {
        id: true,
        batchId: true,
        userId: true,
        batch: { select: { id: true } },
      },
    }),
    prisma.student.findMany({
      where: {
        parentUserId: { not: null },
        instituteId: { not: null },
      },
      select: {
        id: true,
        instituteId: true,
        parent: { select: { instituteId: true } },
      },
    }),
  ]);

  const issues: PlatformHealthIssue[] = [];

  for (const b of batchesMissingBranch) {
    issues.push({
      id: issueId("batch.missing_branch", b.id),
      category: "batch.missing_branch",
      severity: "warning",
      instituteId: b.instituteId,
      instituteName: instituteName(b.instituteId, nameById),
      entityType: "batch",
      entityId: b.id,
      title: "Batch has no branch",
      description:
        "This batch belongs to an institute but is not assigned to a branch. Head coaches may not see these students in branch-scoped views.",
      recommendedAction:
        "Assign the batch to the correct branch in the tenant admin UI.",
    });
  }

  for (const b of batchesWithBranch) {
    if (!b.branch) {
      issues.push({
        id: issueId("batch.branch_orphan_fk", b.id),
        category: "batch.branch_orphan_fk",
        severity: "warning",
        instituteId: b.instituteId,
        instituteName: instituteName(b.instituteId, nameById),
        entityType: "batch",
        entityId: b.id,
        title: "Batch references missing branch",
        description:
          "This batch points to a branch row that no longer exists. Clearing the invalid reference is safe; assign a valid branch afterward if needed.",
        recommendedAction:
          "Clear invalid branch reference, then assign the batch to a valid branch if needed.",
      });
      continue;
    }

    const bid = b.branch.instituteId ?? null;
    if (bid !== b.instituteId) {
      issues.push({
        id: issueId("batch.branch_institute_mismatch", b.id),
        category: "batch.branch_institute_mismatch",
        severity: "critical",
        instituteId: b.instituteId,
        instituteName: instituteName(b.instituteId, nameById),
        entityType: "batch",
        entityId: b.id,
        title: "Batch branch does not match institute",
        description:
          "The batch’s institute does not match its branch’s institute. This indicates a cross-tenant data integrity risk.",
        recommendedAction:
          "Review batch and branch records in the database; align branch and institute on the batch.",
      });
    }
  }

  for (const s of studentsMissingBatch) {
    issues.push({
      id: issueId("student.missing_batch", s.id),
      category: "student.missing_batch",
      severity: "warning",
      instituteId: s.instituteId,
      instituteName: instituteName(s.instituteId, nameById),
      entityType: "student",
      entityId: s.id,
      title: "Student has no batch",
      description:
        "This student is tied to an institute but has no batch. They may be missing from batch-based coach workflows.",
      recommendedAction:
        "Assign the student to the correct batch in the tenant admin UI.",
    });
  }

  for (const s of studentsWithBatch) {
    if (!s.batch) {
      issues.push({
        id: issueId("student.batch_orphan_fk", s.id),
        category: "student.batch_orphan_fk",
        severity: "warning",
        instituteId: s.instituteId,
        instituteName: instituteName(s.instituteId, nameById),
        entityType: "student",
        entityId: s.id,
        title: "Student references missing batch",
        description:
          "This student points to a batch row that no longer exists. Clearing the invalid reference is safe.",
        recommendedAction:
          "Clear the invalid batch reference, then assign the student to a valid batch if needed.",
      });
      continue;
    }

    const bid = s.batch.instituteId ?? null;
    if (bid !== s.instituteId) {
      issues.push({
        id: issueId("student.batch_institute_mismatch", s.id),
        category: "student.batch_institute_mismatch",
        severity: "critical",
        instituteId: s.instituteId,
        instituteName: instituteName(s.instituteId, nameById),
        entityType: "student",
        entityId: s.id,
        title: "Student batch does not match institute",
        description:
          "The student’s institute does not match the batch’s institute. This indicates a cross-tenant assignment risk.",
        recommendedAction:
          "Review student and batch assignment; ensure the batch belongs to the same institute as the student.",
      });
    }
  }

  for (const u of headCoachesMissingBranch) {
    issues.push({
      id: issueId("user.head_coach_missing_branch", u.id),
      category: "user.head_coach_missing_branch",
      severity: "warning",
      instituteId: u.instituteId,
      instituteName: instituteName(u.instituteId, nameById),
      entityType: "user",
      entityId: u.id,
      title: "Head coach has no branch",
      description:
        "This head coach account has an institute but no branch. They may not see students scoped to a branch.",
      recommendedAction:
        "Assign the head coach to the correct branch in the tenant admin UI.",
    });
  }

  for (const u of headCoachesWithBranch) {
    if (!u.branch) {
      issues.push({
        id: issueId("user.head_coach_branch_orphan_fk", u.id),
        category: "user.head_coach_branch_orphan_fk",
        severity: "warning",
        instituteId: u.instituteId,
        instituteName: instituteName(u.instituteId, nameById),
        entityType: "user",
        entityId: u.id,
        title: "Head coach references missing branch",
        description:
          "This head coach points to a branch row that no longer exists. Clearing the invalid reference is safe.",
        recommendedAction:
          "Clear the invalid branch reference, then assign a valid branch if needed.",
      });
      continue;
    }

    const bid = u.branch.instituteId ?? null;
    if (bid !== u.instituteId) {
      issues.push({
        id: issueId("user.head_coach_branch_institute_mismatch", u.id),
        category: "user.head_coach_branch_institute_mismatch",
        severity: "critical",
        instituteId: u.instituteId,
        instituteName: instituteName(u.instituteId, nameById),
        entityType: "user",
        entityId: u.id,
        title: "Head coach branch does not match institute",
        description:
          "The head coach’s institute does not match their branch’s institute. This indicates a cross-tenant role scope risk.",
        recommendedAction:
          "Review user branch and institute fields; align them to the same tenant.",
      });
    }
  }

  for (const row of assistantsOnBranchlessBatches) {
    issues.push({
      id: issueId("batch_assistant.batch_missing_branch", row.id),
      category: "batch_assistant.batch_missing_branch",
      severity: "warning",
      instituteId: row.batch?.instituteId ?? null,
      instituteName: instituteName(row.batch?.instituteId ?? null, nameById),
      entityType: "batch_assistant",
      entityId: row.id,
      title: "Assistant assigned to batch without branch",
      description:
        "An assistant is linked to a batch that has no branch. Assignment may behave inconsistently in branch-scoped flows.",
      recommendedAction:
        "Set a branch on the batch, or move the assistant to batches that have branches.",
    });
  }

  for (const row of batchAssistantsWithBatchRef) {
    if (row.batch) continue;
    issues.push({
      id: issueId("batch_assistant.batch_orphan_fk", row.id),
      category: "batch_assistant.batch_orphan_fk",
      severity: "warning",
      instituteId: null,
      instituteName: null,
      entityType: "batch_assistant",
      entityId: row.id,
      title: "Assistant assignment references missing batch",
      description:
        "This assistant assignment points to a batch row that no longer exists. Removing the assignment is safe.",
      recommendedAction:
        "Remove the invalid assignment; re-assign the assistant to valid batches if needed.",
    });
  }

  for (const s of studentsWithParent) {
    const p = s.parent;
    if (!p) continue;
    const pinst = p.instituteId;
    if (pinst == null) continue;
    if (pinst !== s.instituteId) {
      issues.push({
        id: issueId("parent.student_institute_mismatch", s.id),
        category: "parent.student_institute_mismatch",
        severity: "critical",
        instituteId: s.instituteId,
        instituteName: instituteName(s.instituteId, nameById),
        entityType: "student",
        entityId: s.id,
        title: "Parent and student institutes differ",
        description:
          "The linked parent account belongs to a different institute than the student. This breaks parent–child access boundaries.",
        recommendedAction:
          "Review parent linkage and institute membership; correct the parent or student institute assignment.",
      });
    }
  }

  issues.sort(
    (a, b) =>
      severityOrder(a.severity) - severityOrder(b.severity) ||
      a.category.localeCompare(b.category) ||
      a.entityId.localeCompare(b.entityId),
  );

  const trimmed = issues.slice(0, MAX_ISSUES);
  const criticalCount = trimmed.filter((i) => i.severity === "critical").length;
  const warningCount = trimmed.filter((i) => i.severity === "warning").length;

  return {
    summary: {
      totalIssues: trimmed.length,
      criticalCount,
      warningCount,
      checkedAt,
    },
    issues: trimmed,
  };
}
