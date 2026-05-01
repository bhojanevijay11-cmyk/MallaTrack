/**
 * Read-only tenant / branch / roster integrity checks for one institute.
 * Grep: tenant-integrity-diagnostics
 *
 * Used by GET /api/admin/tenant-integrity and admin diagnostics page.
 * Does not modify data.
 *
 * Repair policy (what is safe to fix vs manual review): `lib/tenant-integrity-repair-policy.ts`
 * and `docs/tenant-integrity-repair.md`.
 */
import { prisma } from "@/lib/prisma";
import {
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
} from "@/lib/roles";

export const TENANT_INTEGRITY_TAG = "tenant-integrity-diagnostics" as const;

export type TenantIntegrityEntityType =
  | "Batch"
  | "Student"
  | "User"
  | "ProgressAssessment"
  | "Attendance"
  | "BatchAssistant";

export type TenantIntegrityFinding = {
  category: string;
  entityType: TenantIntegrityEntityType;
  recordId: string;
  instituteId: string | null;
  branchId?: string | null;
  batchId?: string | null;
  studentId?: string | null;
  userId?: string | null;
  reason: string;
};

export type TenantIntegrityReport = {
  tag: typeof TENANT_INTEGRITY_TAG;
  instituteId: string;
  generatedAt: string;
  /** Findings grouped by category key (stable, grep-friendly). */
  byCategory: Record<string, TenantIntegrityFinding[]>;
  totals: Record<string, number>;
  limits: {
    attendanceRowsScannedMax: number;
    attendanceRowsScanned: number;
  };
};

function bucket(
  map: Record<string, TenantIntegrityFinding[]>,
  f: TenantIntegrityFinding,
) {
  const k = f.category;
  if (!map[k]) map[k] = [];
  map[k].push(f);
}

function baseFinding(
  category: string,
  entityType: TenantIntegrityEntityType,
  recordId: string,
  instituteId: string | null,
  reason: string,
  extra?: Partial<
    Pick<TenantIntegrityFinding, "branchId" | "batchId" | "studentId" | "userId">
  >,
): TenantIntegrityFinding {
  return {
    category,
    entityType,
    recordId,
    instituteId,
    reason,
    ...extra,
  };
}

/**
 * Run all checks scoped to a single institute (admin’s tenant only).
 */
export async function runTenantIntegrityDiagnostics(
  instituteId: string,
): Promise<TenantIntegrityReport> {
  const generatedAt = new Date().toISOString();
  const byCategory: Record<string, TenantIntegrityFinding[]> = {};

  const [
    batchesNullBranch,
    batchesWithBranch,
    studentsInInstitute,
    studentsInstituteMismatchWithBatch,
    hcUsers,
    asstUsers,
    assistantLinksOnNullBranch,
    progressRows,
    attendanceRows,
  ] = await Promise.all([
    prisma.batch.findMany({
      where: { instituteId, branchId: null },
      select: { id: true, instituteId: true, name: true },
    }),
    prisma.batch.findMany({
      where: { instituteId, branchId: { not: null } },
      select: {
        id: true,
        instituteId: true,
        branchId: true,
        branch: { select: { id: true, instituteId: true } },
      },
    }),
    prisma.student.findMany({
      where: { instituteId },
      select: {
        id: true,
        instituteId: true,
        batchId: true,
        batch: { select: { id: true, instituteId: true, branchId: true } },
      },
    }),
    prisma.student.findMany({
      where: {
        batchId: { not: null },
        batch: { instituteId },
        OR: [{ instituteId: null }, { instituteId: { not: instituteId } }],
      },
      select: {
        id: true,
        instituteId: true,
        batchId: true,
        batch: { select: { instituteId: true, branchId: true } },
      },
    }),
    prisma.user.findMany({
      where: { instituteId, role: ROLE_HEAD_COACH },
      select: {
        id: true,
        instituteId: true,
        branchId: true,
        branch: { select: { id: true, instituteId: true } },
      },
    }),
    prisma.user.findMany({
      where: { instituteId, role: ROLE_ASSISTANT_COACH },
      select: {
        id: true,
        instituteId: true,
        branchId: true,
        branch: { select: { id: true, instituteId: true } },
        assistantAssignments: {
          select: {
            id: true,
            batchId: true,
            batch: { select: { id: true, branchId: true, instituteId: true } },
          },
        },
      },
    }),
    prisma.batchAssistant.findMany({
      where: { batch: { instituteId, branchId: null } },
      select: {
        id: true,
        userId: true,
        batchId: true,
        batch: { select: { instituteId: true } },
      },
    }),
    prisma.progressAssessment.findMany({
      where: { instituteId },
      select: {
        id: true,
        instituteId: true,
        studentId: true,
        batchId: true,
        student: { select: { id: true, instituteId: true, batchId: true } },
        batch: { select: { id: true, instituteId: true, branchId: true } },
      },
    }),
    prisma.attendance.findMany({
      where: { batch: { instituteId } },
      select: {
        id: true,
        instituteId: true,
        studentId: true,
        batchId: true,
        student: { select: { id: true, instituteId: true, batchId: true } },
        batch: { select: { id: true, instituteId: true } },
      },
      take: 2000,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  for (const b of batchesNullBranch) {
    bucket(
      byCategory,
      baseFinding(
        "batch.missing_branch",
        "Batch",
        b.id,
        b.instituteId,
        "Batch has no branchId; head-coach scope and new writes may fail until a branch is assigned.",
        { branchId: null, batchId: b.id },
      ),
    );
  }

  for (const b of batchesWithBranch) {
    const bid = b.branchId?.trim() ?? null;
    if (!bid) continue;
    if (!b.branch) {
      bucket(
        byCategory,
        baseFinding(
          "batch.branch_orphan_fk",
          "Batch",
          b.id,
          b.instituteId,
          "branchId points to a missing Branch row.",
          { branchId: bid, batchId: b.id },
        ),
      );
      continue;
    }
    if (b.branch.instituteId !== b.instituteId) {
      bucket(
        byCategory,
        baseFinding(
          "batch.branch_institute_mismatch",
          "Batch",
          b.id,
          b.instituteId,
          "Branch belongs to a different institute than this batch.",
          { branchId: bid, batchId: b.id },
        ),
      );
    }
  }

  for (const s of studentsInInstitute) {
    if (s.batchId && !s.batch) {
      bucket(
        byCategory,
        baseFinding(
          "student.batch_orphan_fk",
          "Student",
          s.id,
          s.instituteId,
          "batchId points to a missing Batch row.",
          { batchId: s.batchId, studentId: s.id },
        ),
      );
      continue;
    }
    if (s.batch && s.batch.instituteId !== s.instituteId) {
      bucket(
        byCategory,
        baseFinding(
          "student.batch_institute_mismatch",
          "Student",
          s.id,
          s.instituteId,
          "Student instituteId does not match assigned batch instituteId.",
          {
            batchId: s.batchId,
            studentId: s.id,
            branchId: s.batch.branchId ?? null,
          },
        ),
      );
    }
  }

  for (const s of studentsInstituteMismatchWithBatch) {
    bucket(
      byCategory,
      baseFinding(
        "student.institute_not_aligned_with_batch",
        "Student",
        s.id,
        s.instituteId,
        "Student instituteId is null or differs from roster batch in this institute (fix instituteId or batch).",
        {
          batchId: s.batchId,
          studentId: s.id,
          branchId: s.batch?.branchId ?? null,
        },
      ),
    );
  }

  for (const u of hcUsers) {
    const home = u.branchId?.trim() ?? null;
    if (!home) {
      bucket(
        byCategory,
        baseFinding(
          "user.head_coach_missing_branch",
          "User",
          u.id,
          u.instituteId,
          "Head coach has no branchId; branch-scoped visibility is empty until assigned.",
          { userId: u.id, branchId: null },
        ),
      );
      continue;
    }
    if (!u.branch || u.branch.instituteId !== u.instituteId) {
      bucket(
        byCategory,
        baseFinding(
          "user.head_coach_invalid_branch",
          "User",
          u.id,
          u.instituteId,
          "Head coach branchId is missing Branch row or branch is not in this institute.",
          { userId: u.id, branchId: home },
        ),
      );
    }
  }

  for (const u of asstUsers) {
    const home = u.branchId?.trim() ?? null;
    if (home) {
      if (!u.branch || u.branch.instituteId !== u.instituteId) {
        bucket(
          byCategory,
          baseFinding(
            "user.assistant_invalid_home_branch",
            "User",
            u.id,
            u.instituteId,
            "Assistant home branchId is invalid or not in this institute.",
            { userId: u.id, branchId: home },
          ),
        );
      }
      for (const a of u.assistantAssignments) {
        const bb = a.batch?.branchId?.trim() ?? null;
        if (bb && bb !== home) {
          bucket(
            byCategory,
            baseFinding(
              "user.assistant_home_branch_vs_batch_assignment",
              "User",
              u.id,
              u.instituteId,
              "Assistant has a home branch that differs from an assigned batch’s branch (can block or confuse scoped access).",
              { userId: u.id, branchId: home, batchId: a.batchId },
            ),
          );
        }
      }
    }
  }

  for (const row of assistantLinksOnNullBranch) {
    bucket(
      byCategory,
      baseFinding(
        "batch_assistant.on_batch_missing_branch",
        "BatchAssistant",
        row.id,
        row.batch?.instituteId ?? instituteId,
        "Assistant is assigned to a batch with no branchId.",
        { userId: row.userId, batchId: row.batchId },
      ),
    );
  }

  for (const p of progressRows) {
    if (!p.student) {
      bucket(
        byCategory,
        baseFinding(
          "progress_assessment.student_missing",
          "ProgressAssessment",
          p.id,
          p.instituteId,
          "Student row missing for studentId.",
          { studentId: p.studentId, batchId: p.batchId },
        ),
      );
      continue;
    }
    if (p.student.instituteId !== p.instituteId) {
      bucket(
        byCategory,
        baseFinding(
          "progress_assessment.student_institute_mismatch",
          "ProgressAssessment",
          p.id,
          p.instituteId,
          "Assessment instituteId does not match student instituteId.",
          { studentId: p.studentId, batchId: p.batchId },
        ),
      );
    }
    if (!p.batch) {
      bucket(
        byCategory,
        baseFinding(
          "progress_assessment.batch_missing",
          "ProgressAssessment",
          p.id,
          p.instituteId,
          "Batch row missing for batchId.",
          { studentId: p.studentId, batchId: p.batchId },
        ),
      );
      continue;
    }
    if (p.batch.instituteId !== p.instituteId) {
      bucket(
        byCategory,
        baseFinding(
          "progress_assessment.batch_institute_mismatch",
          "ProgressAssessment",
          p.id,
          p.instituteId,
          "Assessment instituteId does not match batch instituteId.",
          {
            studentId: p.studentId,
            batchId: p.batchId,
            branchId: p.batch.branchId ?? null,
          },
        ),
      );
    }
    if (p.student.batchId !== p.batchId) {
      bucket(
        byCategory,
        baseFinding(
          "progress_assessment.student_current_batch_mismatch",
          "ProgressAssessment",
          p.id,
          p.instituteId,
          "Student’s current batchId differs from assessment batchId (roster moved or stale assessment).",
          {
            studentId: p.studentId,
            batchId: p.batchId,
            branchId: p.batch.branchId ?? null,
          },
        ),
      );
    }
  }

  for (const a of attendanceRows) {
    const batchInst = a.batch?.instituteId ?? null;
    const stuInst = a.student?.instituteId ?? null;
    if (a.instituteId != null && batchInst != null && a.instituteId !== batchInst) {
      bucket(
        byCategory,
        baseFinding(
          "attendance.institute_vs_batch_mismatch",
          "Attendance",
          a.id,
          a.instituteId,
          "Attendance.instituteId does not match batch instituteId.",
          { studentId: a.studentId, batchId: a.batchId },
        ),
      );
    }
    if (stuInst != null && batchInst != null && stuInst !== batchInst) {
      bucket(
        byCategory,
        baseFinding(
          "attendance.student_vs_batch_institute_mismatch",
          "Attendance",
          a.id,
          a.instituteId ?? batchInst,
          "Student instituteId does not match batch instituteId for this attendance row.",
          { studentId: a.studentId, batchId: a.batchId },
        ),
      );
    }
    if (a.student && a.student.batchId !== a.batchId) {
      bucket(
        byCategory,
        baseFinding(
          "attendance.student_current_batch_mismatch",
          "Attendance",
          a.id,
          a.instituteId ?? batchInst,
          "Student’s current batchId differs from attendance batchId (may be stale after roster change).",
          { studentId: a.studentId, batchId: a.batchId },
        ),
      );
    }
  }

  const totals: Record<string, number> = {};
  for (const [k, arr] of Object.entries(byCategory)) {
    totals[k] = arr.length;
  }

  return {
    tag: TENANT_INTEGRITY_TAG,
    instituteId,
    generatedAt,
    byCategory,
    totals,
    limits: {
      /** Attendance rows are newest-first; raise if totals approach this cap. */
      attendanceRowsScannedMax: 2000,
      attendanceRowsScanned: attendanceRows.length,
    },
  };
}
