import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import {
  buildBatchScopeWhere,
  buildProgressScopeWhere,
  buildStudentScopeWhere,
} from "@/lib/authz-prisma-scopes";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import { overallScoreForDisplay } from "@/lib/progress-assessment-category-scores";
import { getReadinessFromAssessment, READINESS_LEVEL } from "@/lib/progress-readiness";
import { ROLE_ADMIN, ROLE_HEAD_COACH } from "@/lib/roles";

const RECENT_APPROVED_LIMIT = 10;

/**
 * IMPORTANT:
 * If your Prisma model delegate is NOT `prisma.progressAssessment`,
 * change ONLY this one line to the actual generated delegate name.
 *
 * Examples:
 *   const assessmentRepo = prisma.progressAssessmentV2;
 *   const assessmentRepo = prisma.assessment;
 */
const assessmentRepo = prisma.progressAssessment;

type ProgressAssessmentWhere = Awaited<ReturnType<typeof buildProgressScopeWhere>>;

export type ProgressV2RecentApprovedRow = {
  id: string;
  studentId: string;
  studentName: string;
  batchName: string | null;
  assessmentDateYmd: string;
  overallScore: number | null;
  assessmentIndicator: string | null;
};

export type ProgressV2BatchBreakdownRow = {
  batchId: string;
  batchName: string | null;
  approvedCount: number;
  avgOverallScore: number | null;
};

/** Students with no approved assessment are counted as Needs Work. */
export type ProgressV2ReadinessByLevel = {
  needsWork: number;
  developing: number;
  nearlyReady: number;
  competitionReady: number;
};

export type ProgressV2ReportingSnapshot = {
  pendingReviewCount: number;
  /** Assessments in NEEDS_REVISION — same cardinality as `/progress/review?status=NEEDS_REVISION` queue. */
  needsRevisionAssessmentCount: number;
  approvedCount: number;
  avgApprovedOverallScore: number | null;
  recentApproved: ProgressV2RecentApprovedRow[];
  batchBreakdown: ProgressV2BatchBreakdownRow[];
  readinessByLevel: ProgressV2ReadinessByLevel;
};

function emptyReadinessByLevel(): ProgressV2ReadinessByLevel {
  return {
    needsWork: 0,
    developing: 0,
    nearlyReady: 0,
    competitionReady: 0,
  };
}

function emptySnapshot(): ProgressV2ReportingSnapshot {
  return {
    pendingReviewCount: 0,
    needsRevisionAssessmentCount: 0,
    approvedCount: 0,
    avgApprovedOverallScore: null,
    recentApproved: [],
    batchBreakdown: [],
    readinessByLevel: emptyReadinessByLevel(),
  };
}

function getScopedStudentIds(where: ProgressAssessmentWhere): string[] | null {
  const sid = where.studentId;

  if (
    typeof sid === "object" &&
    sid !== null &&
    "in" in sid &&
    Array.isArray(sid.in)
  ) {
    return sid.in.filter((id: unknown): id is string => typeof id === "string");
  }

  return null;
}

function isEmptyStudentScope(where: ProgressAssessmentWhere): boolean {
  const ids = getScopedStudentIds(where);
  return Array.isArray(ids) && ids.length === 0;
}

/**
 * Same student set as progress assessments in this scope (intersects explicit
 * assessment student ids with {@link buildStudentScopeWhere} when ids are present).
 */
export async function studentWhereForReportingScope(
  user: SessionUserWithInstitute,
  assessmentWhere: ProgressAssessmentWhere,
): Promise<Prisma.StudentWhereInput> {
  const scopedIds = getScopedStudentIds(assessmentWhere);

  if (scopedIds) {
    return { id: { in: scopedIds } };
  }

  return buildStudentScopeWhere(user);
}

/**
 * Progress V2 reporting for Admin (institute-wide) or Head Coach (same student scope as progress APIs).
 * Ignores DRAFT / NEEDS_REVISION for approval metrics; pending count is PENDING_REVIEW only.
 */
export async function getProgressV2ReportingSnapshot(
  user: SessionUserWithInstitute,
): Promise<ProgressV2ReportingSnapshot> {
  if (user.role !== ROLE_ADMIN && user.role !== ROLE_HEAD_COACH) {
    return emptySnapshot();
  }

  const [baseWhere, batchScope] = await Promise.all([
    buildProgressScopeWhere(user),
    buildBatchScopeWhere(user),
  ]);
  if (isEmptyStudentScope(baseWhere)) {
    return emptySnapshot();
  }

  const pendingWhere: ProgressAssessmentWhere = {
    ...baseWhere,
    status: PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW,
  };

  const revisionWhere: ProgressAssessmentWhere = {
    ...baseWhere,
    status: PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION,
  };

  const approvedWhere: ProgressAssessmentWhere = {
    ...baseWhere,
    status: PROGRESS_ASSESSMENT_STATUS.APPROVED,
  };

  const studentWhere = await studentWhereForReportingScope(user, baseWhere);

  const [
    pendingReviewCount,
    needsRevisionAssessmentCount,
    approvedCount,
    approvedScoreRows,
    scopedStudents,
  ] = await Promise.all([
    assessmentRepo.count({ where: pendingWhere }),
    assessmentRepo.count({ where: revisionWhere }),
    assessmentRepo.count({ where: approvedWhere }),
    assessmentRepo.findMany({
      where: approvedWhere,
      orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        studentId: true,
        batchId: true,
        assessmentDate: true,
        createdAt: true,
        strengthScore: true,
        flexibilityScore: true,
        techniqueScore: true,
        disciplineScore: true,
        overallScore: true,
        assessmentIndicator: true,
        student: { select: { id: true, fullName: true } },
        batch: { select: { id: true, name: true } },
      },
    }),
    prisma.student.findMany({
      where: studentWhere,
      select: { id: true },
    }),
  ]);

  let sumEffectiveOverall = 0;
  let countEffectiveOverall = 0;
  const batchSumCount = new Map<string, { sum: number; count: number }>();
  const batchApprovedCount = new Map<string, number>();
  const latestApprovedByStudent = new Map<string, { overallScore: number | null }>();

  for (const r of approvedScoreRows) {
    const eff = overallScoreForDisplay({
      strengthScore: r.strengthScore,
      flexibilityScore: r.flexibilityScore,
      techniqueScore: r.techniqueScore,
      disciplineScore: r.disciplineScore,
      storedOverallScore: r.overallScore,
    });

    if (eff != null) {
      sumEffectiveOverall += eff;
      countEffectiveOverall += 1;
      const bid = r.batchId;
      if (typeof bid === "string" && bid.length > 0) {
        const cur = batchSumCount.get(bid) ?? { sum: 0, count: 0 };
        cur.sum += eff;
        cur.count += 1;
        batchSumCount.set(bid, cur);
      }
    }

    const bidCount = r.batchId;
    if (typeof bidCount === "string" && bidCount.length > 0) {
      batchApprovedCount.set(bidCount, (batchApprovedCount.get(bidCount) ?? 0) + 1);
    }

    if (!latestApprovedByStudent.has(r.studentId)) {
      latestApprovedByStudent.set(r.studentId, { overallScore: eff });
    }
  }

  const avgApprovedOverallScore =
    countEffectiveOverall > 0
      ? Math.round((sumEffectiveOverall / countEffectiveOverall) * 10) / 10
      : null;

  const recentApproved: ProgressV2RecentApprovedRow[] = approvedScoreRows
    .slice(0, RECENT_APPROVED_LIMIT)
    .map((r) => {
      const iso = r.assessmentDate.toISOString();
      const ymd = iso.slice(0, 10);

      return {
        id: r.id,
        studentId: r.student.id,
        studentName: r.student.fullName,
        batchName: r.batch?.name?.trim() || null,
        assessmentDateYmd: ymd,
        overallScore: overallScoreForDisplay({
          strengthScore: r.strengthScore,
          flexibilityScore: r.flexibilityScore,
          techniqueScore: r.techniqueScore,
          disciplineScore: r.disciplineScore,
          storedOverallScore: r.overallScore,
        }),
        assessmentIndicator: r.assessmentIndicator,
      };
    });

  const batchIds = [...batchApprovedCount.keys()];

  const batchMeta =
    batchIds.length > 0
      ? await prisma.batch.findMany({
          where: { AND: [batchScope, { id: { in: batchIds } }] },
          select: { id: true, name: true },
        })
      : [];

  const nameById = new Map<string, string | null>(
    batchMeta.map((b: { id: string; name: string | null }) => [b.id, b.name]),
  );

  const batchBreakdown: ProgressV2BatchBreakdownRow[] = batchIds
    .map((batchId) => {
      const stats = batchSumCount.get(batchId);
      const approvedN = batchApprovedCount.get(batchId) ?? 0;
      const avgOverallScore =
        stats && stats.count > 0
          ? Math.round((stats.sum / stats.count) * 10) / 10
          : null;

      return {
        batchId,
        batchName: nameById.get(batchId)?.trim() || null,
        approvedCount: approvedN,
        avgOverallScore,
      };
    })
    .sort(
      (a: ProgressV2BatchBreakdownRow, b: ProgressV2BatchBreakdownRow) =>
        b.approvedCount - a.approvedCount,
    );

  const readinessByLevel = emptyReadinessByLevel();

  for (const { id } of scopedStudents as Array<{ id: string }>) {
    const latest = latestApprovedByStudent.get(id);
    const readiness = latest
      ? getReadinessFromAssessment({
          status: PROGRESS_ASSESSMENT_STATUS.APPROVED,
          overallScore: latest.overallScore,
        })
      : getReadinessFromAssessment(null);

    if (readiness.level === READINESS_LEVEL.NEEDS_WORK) {
      readinessByLevel.needsWork += 1;
    } else if (readiness.level === READINESS_LEVEL.DEVELOPING) {
      readinessByLevel.developing += 1;
    } else if (readiness.level === READINESS_LEVEL.NEARLY_READY) {
      readinessByLevel.nearlyReady += 1;
    } else {
      readinessByLevel.competitionReady += 1;
    }
  }

  return {
    pendingReviewCount,
    needsRevisionAssessmentCount,
    approvedCount,
    avgApprovedOverallScore,
    recentApproved,
    batchBreakdown,
    readinessByLevel,
  };
}