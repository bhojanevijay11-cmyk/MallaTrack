import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { buildAttendanceScopeWhere, buildStudentScopeWhere } from "@/lib/authz-prisma-scopes";
import { resolveBranchHeadCoachLabels } from "@/lib/branch-head-coach";
import { staffUserLabel } from "@/lib/staff-user-label";
import { emptyProgressAlertCounts, type ProgressAlertCounts } from "@/lib/progress-alerts";
import { getProgressAlertCountsForUser } from "@/lib/progress-alerts-queries";
import type { ProgressV2ReportingSnapshot } from "@/lib/progress-v2-reporting-queries";
import { getProgressV2ReportingSnapshot } from "@/lib/progress-v2-reporting-queries";
import {
  ATTENDANCE_MARK_STATUSES,
  ATTENDANCE_STATUSES_COUNTED_AS_ATTENDED_FOR_RATE,
  isAbsentStatus,
  isAttendancePresentLike,
  isMarkedAttendanceStatus,
  parseAttendanceMarkStatus,
} from "@/lib/attendance-status";
import { getIndiaTodayCalendarYmd } from "@/lib/datetime-india";
import {
  headCoachActiveEnrollmentWhereInput,
  headCoachBatchWhereInput,
} from "@/lib/head-coach-scope";
import { ROLE_HEAD_COACH } from "@/lib/roles";
import { debugLogHeadCoachScope } from "@/lib/head-coach-scope-debug";
import { runHeadCoachCompareAudit } from "@/lib/head-coach-compare-audit";
import { auditStaffUserTenantLinkage } from "@/lib/legacy-staff-audit";
import {
  compareAdminActiveStudentsToHeadCoachBranchScope,
  debugLogStudentBranchAudit,
  fetchStudentBranchLinkageDetailedSamples,
} from "@/lib/student-branch-linkage-audit";

function expandRecentCalendarDays(endYmd: string, count: number): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endYmd.trim());
  if (!m) return [endYmd];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(y, mo - 1, d - i));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    out.push(`${yy}-${mm}-${dd}`);
  }
  return out.reverse();
}

export type AttentionItem = {
  studentId: string;
  studentName: string;
  batchId: string | null;
  batchName: string | null;
  reasonLabel: string;
};

export type HeadCoachDashboardSnapshot = {
  branchName: string | null;
  todayYmd: string;
  summary: {
    activeBatches: number;
    enrolledStudents: number;
    assistantCoachCount: number;
  };
  todayAttendance: {
    hasSubmission: boolean;
    /** PRESENT + LATE for branch-wide rate KPI — not strict on-time present count. */
    presentCount: number;
    expectedCount: number;
    percent: number | null;
  };
  attentionStudents: AttentionItem[];
  batches: Array<{
    id: string;
    name: string | null;
    startTime: string | null;
    endTime: string | null;
    /** Head coach user(s) assigned to the batch's branch (roster). */
    branchHeadCoachLabel: string | null;
    /** Legacy Coach table row (directory), if linked. */
    coachName: string | null;
    assistantCoachSummary: string | null;
    studentCount: number;
    status: string;
    todayMarking: "none" | "partial" | "complete";
  }>;
  pendingActions: Array<{ id: string; label: string; href: string }>;
  progressV2: ProgressV2ReportingSnapshot;
  /** Derived progress / readiness attention — same scope as Progress V2. */
  progressAlerts: ProgressAlertCounts;
  /** Students whose primary attention reason is low weekly attendance (see {@link listAttentionForBranch}). */
  lowAttendanceAttentionCount: number;
};

type AttentionReason = "inactive" | "absent_today" | "low_attendance";

function pickAttentionReason(
  reasons: AttentionReason[],
): { reason: AttentionReason; label: string } | null {
  if (reasons.includes("inactive")) return { reason: "inactive", label: "Inactive" };
  if (reasons.includes("absent_today")) return { reason: "absent_today", label: "Absent today" };
  if (reasons.includes("low_attendance")) return { reason: "low_attendance", label: "Low attendance" };
  return null;
}

/**
 * Attention rules for Head Coach: inactive roster, absent today, or low attended rate
 * over marked sessions in the last 7 calendar days. Uses institute-aware batch/student scope.
 */
export async function listAttentionForBranch(
  headCoachUserBranchId: string | null,
  instituteId: string,
  dateYmd: string,
  options?: { headCoachUserId?: string },
): Promise<AttentionItem[]> {
  const hcUser: SessionUserWithInstitute = {
    id: options?.headCoachUserId?.trim() || "__head_coach_scope__",
    role: ROLE_HEAD_COACH,
    branchId: headCoachUserBranchId,
    instituteId,
  };
  const [studentScope, attendanceScope] = await Promise.all([
    buildStudentScopeWhere(hcUser),
    buildAttendanceScopeWhere(hcUser),
  ]);

  const students = await prisma.student.findMany({
    where: studentScope,
    include: { batch: { select: { id: true, name: true } } },
  });

  if (students.length === 0) return [];

  const studentIds = students.map((s) => s.id);
  const last7 = expandRecentCalendarDays(dateYmd, 7);

  const att7Where: Prisma.AttendanceWhereInput = {
    AND: [
      attendanceScope,
      { studentId: { in: studentIds }, date: { in: last7 } },
    ],
  };
  const att7 = await prisma.attendance.findMany({
    where: att7Where,
    select: { studentId: true, batchId: true, date: true, status: true },
  });

  const byStudent7 = new Map<string, typeof att7>();
  for (const r of att7) {
    const cur = byStudent7.get(r.studentId) ?? [];
    cur.push(r);
    byStudent7.set(r.studentId, cur);
  }

  const out: AttentionItem[] = [];

  for (const s of students) {
    const reasons: AttentionReason[] = [];
    const st = (s.status ?? "").toUpperCase();
    if (st !== "ACTIVE") {
      reasons.push("inactive");
    }

    const bid = s.batchId;
    if (bid) {
      const tRow = att7.find(
        (r) =>
          r.studentId === s.id &&
          r.batchId === bid &&
          r.date === dateYmd,
      );
      if (tRow && isAbsentStatus(parseAttendanceMarkStatus(tRow.status))) {
        reasons.push("absent_today");
      }
    }

    const week = byStudent7.get(s.id) ?? [];
    const marked = week.filter((r) =>
      isMarkedAttendanceStatus(parseAttendanceMarkStatus(r.status)),
    );
    if (marked.length >= 3) {
      const attendedForRate = marked.filter((r) =>
        isAttendancePresentLike(parseAttendanceMarkStatus(r.status)),
      ).length;
      if (attendedForRate / marked.length < 0.5) {
        reasons.push("low_attendance");
      }
    }

    const picked = pickAttentionReason(reasons);
    if (picked) {
      out.push({
        studentId: s.id,
        studentName: s.fullName,
        batchId: s.batch?.id ?? null,
        batchName: s.batch?.name ?? null,
        reasonLabel: picked.label,
      });
    }
  }

  return out;
}

export async function getAttentionStudentIdsForBranch(
  headCoachUserBranchId: string | null,
  instituteId: string,
  dateYmd: string,
  options?: { headCoachUserId?: string },
): Promise<Set<string>> {
  const items = await listAttentionForBranch(
    headCoachUserBranchId,
    instituteId,
    dateYmd,
    options,
  );
  return new Set(items.map((i) => i.studentId));
}

/** Students whose surfaced attention label is "Low attendance" (subset of {@link listAttentionForBranch}). */
export async function getLowAttendanceAttentionStudentIdsForBranch(
  headCoachUserBranchId: string | null,
  instituteId: string,
  dateYmd: string,
  options?: { headCoachUserId?: string },
): Promise<Set<string>> {
  const items = await listAttentionForBranch(
    headCoachUserBranchId,
    instituteId,
    dateYmd,
    options,
  );
  return new Set(
    items.filter((i) => i.reasonLabel === "Low attendance").map((i) => i.studentId),
  );
}

/**
 * @param headCoachUserBranchId Session `user.branchId` (nullable). Scoped to `instituteId`.
 */
function emptyProgressV2Snapshot(): ProgressV2ReportingSnapshot {
  return {
    pendingReviewCount: 0,
    needsRevisionAssessmentCount: 0,
    approvedCount: 0,
    avgApprovedOverallScore: null,
    recentApproved: [],
    batchBreakdown: [],
    readinessByLevel: {
      needsWork: 0,
      developing: 0,
      nearlyReady: 0,
      competitionReady: 0,
    },
  };
}

export async function getHeadCoachDashboardSnapshot(
  headCoachUserBranchId: string | null,
  instituteId: string,
  options?: { now?: Date; userId?: string },
): Promise<HeadCoachDashboardSnapshot> {
  const now = options?.now ?? new Date();
  const todayYmd = getIndiaTodayCalendarYmd(now);

  const batchWhere = headCoachBatchWhereInput(headCoachUserBranchId, instituteId);
  const hcScopeUser: SessionUserWithInstitute = {
    id: options?.userId?.trim() || "__head_coach_dashboard__",
    role: ROLE_HEAD_COACH,
    branchId: headCoachUserBranchId,
    instituteId,
  };
  const [attendanceScopeForHeadCoach, studentScopeForHeadCoach] = await Promise.all([
    buildAttendanceScopeWhere(hcScopeUser),
    buildStudentScopeWhere(hcScopeUser),
  ]);
  const activeStudentsInBatchesForAttendanceRate: Prisma.StudentWhereInput = {
    AND: [studentScopeForHeadCoach, { status: "ACTIVE", batchId: { not: null } }],
  };

  const branchFromUser =
    headCoachUserBranchId != null
      ? await prisma.branch.findFirst({
          where: { id: headCoachUserBranchId, instituteId },
          select: { name: true },
        })
      : null;

  /** Never infer branch label from other branches in the institute (avoids cross-branch metadata leak). */
  const branchNameFallback = branchFromUser?.name ?? null;

  const progressUserId = options?.userId?.trim() ?? "";
  const sessionUserForProgress =
    progressUserId.length > 0
      ? {
          id: progressUserId,
          role: ROLE_HEAD_COACH,
          branchId: headCoachUserBranchId,
          instituteId,
        }
      : null;

  const progressV2Promise =
    sessionUserForProgress != null
      ? getProgressV2ReportingSnapshot(sessionUserForProgress)
      : Promise.resolve(emptyProgressV2Snapshot());

  const progressAlertsPromise =
    sessionUserForProgress != null
      ? getProgressAlertCountsForUser(sessionUserForProgress)
      : Promise.resolve(emptyProgressAlertCounts());

  const [batchesRaw, expectedCount, assistantCoachCount, progressV2, progressAlerts] =
    await Promise.all([
    prisma.batch.findMany({
      where: batchWhere,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { students: true } },
        coach: { select: { fullName: true } },
        assistantAssignments: {
          include: {
            user: {
              select: {
                email: true,
                invitesReceived: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { fullName: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.student.count({
      where: headCoachActiveEnrollmentWhereInput(headCoachUserBranchId, instituteId),
    }),
    prisma.batchAssistant
      .findMany({
        where: { batch: batchWhere },
        select: { userId: true },
      })
      .then((rows) => new Set(rows.map((r) => r.userId)).size),
    progressV2Promise,
    progressAlertsPromise,
  ]);

  const activeBatches = batchesRaw.filter(
    (b) => (b.status ?? "").toUpperCase() === "ACTIVE",
  );
  const activeBatchIds = activeBatches.map((b) => b.id);

  const branchHeadCoachMap = await resolveBranchHeadCoachLabels(
    instituteId,
    activeBatches.map((b) => b.branchId),
  );

  const [expectedCountForTodayAttendanceRate, attendedTodayForRate, markedToday] =
    await Promise.all([
      prisma.student.count({ where: activeStudentsInBatchesForAttendanceRate }),
      prisma.attendance.count({
        where: {
          AND: [
            attendanceScopeForHeadCoach,
            {
              date: todayYmd,
              status: { in: [...ATTENDANCE_STATUSES_COUNTED_AS_ATTENDED_FOR_RATE] },
            },
          ],
        },
      }),
      prisma.attendance.count({
        where: {
          AND: [
            attendanceScopeForHeadCoach,
            {
              date: todayYmd,
              status: { in: [...ATTENDANCE_MARK_STATUSES] },
            },
          ],
        },
      }),
    ]);

  const hasSubmission = markedToday > 0;
  let percent: number | null = null;
  if (expectedCountForTodayAttendanceRate > 0 && hasSubmission) {
    percent =
      Math.round((attendedTodayForRate / expectedCountForTodayAttendanceRate) * 1000) / 10;
  }

  const attentionAll = await listAttentionForBranch(
    headCoachUserBranchId,
    instituteId,
    todayYmd,
    { headCoachUserId: options?.userId },
  );
  const lowAttendanceAttentionCount = attentionAll.filter((i) => i.reasonLabel === "Low attendance")
    .length;
  const attentionStudents = attentionAll.slice(0, 8);

  const batchTodayStats = await Promise.all(
    activeBatchIds.map(async (batchId) => {
      const [nActive, marked] = await Promise.all([
        prisma.student.count({
          where: { batchId, status: "ACTIVE", instituteId },
        }),
        prisma.attendance.count({
          where: {
            batchId,
            instituteId,
            date: todayYmd,
            status: { in: [...ATTENDANCE_MARK_STATUSES] },
          },
        }),
      ]);
      let todayMarking: "none" | "partial" | "complete" = "none";
      if (marked === 0) todayMarking = "none";
      else if (nActive > 0 && marked >= nActive) todayMarking = "complete";
      else todayMarking = "partial";
      return { batchId, nActive, marked, todayMarking };
    }),
  );
  const batchStatMap = new Map(batchTodayStats.map((s) => [s.batchId, s]));

  const batches = activeBatches.map((b) => {
    const st = batchStatMap.get(b.id);
    const assistantCoachSummary =
      b.assistantAssignments.length > 0
        ? b.assistantAssignments.map((a) => staffUserLabel(a.user)).join(" · ")
        : null;
    return {
      id: b.id,
      name: b.name,
      startTime: b.startTime,
      endTime: b.endTime,
      branchHeadCoachLabel: b.branchId
        ? (branchHeadCoachMap.get(b.branchId) ?? null)
        : null,
      coachName: b.coach?.fullName ?? null,
      assistantCoachSummary,
      studentCount: b._count.students,
      status: b.status,
      todayMarking: st?.todayMarking ?? "none",
    };
  });

  const pendingActions: HeadCoachDashboardSnapshot["pendingActions"] = [];
  const attentionCount = attentionAll.length;
  if (attentionCount > 0) {
    pendingActions.push({
      id: "attention",
      label:
        attentionCount === 1
          ? "Review 1 student needing attention"
          : `Review ${attentionCount} students needing attention`,
      href: "/students?filter=needs-attention",
    });
  }

  const batchesNeedingMarking = batchTodayStats.filter(
    (s) => s.nActive > 0 && s.todayMarking !== "complete",
  ).length;
  if (batchesNeedingMarking > 0) {
    pendingActions.push({
      id: "attendance-mark",
      label:
        batchesNeedingMarking === 1
          ? "Complete attendance for 1 batch today"
          : `Complete attendance for ${batchesNeedingMarking} batches today`,
      href: "/attendance",
    });
  }

  const batchesNoCoach = activeBatches.filter((b) => !b.coachId).length;
  if (batchesNoCoach > 0) {
    pendingActions.push({
      id: "coach-assign",
      label:
        batchesNoCoach === 1
          ? "Link a coach directory entry to 1 batch"
          : `Link coach directory entries to ${batchesNoCoach} batches`,
      href: "/batches",
    });
  }

  if (progressV2.pendingReviewCount > 0) {
    pendingActions.unshift({
      id: "progress-review",
      label:
        progressV2.pendingReviewCount === 1
          ? "Review 1 progress assessment"
          : `Review ${progressV2.pendingReviewCount} progress assessments`,
      href: "/progress/review?status=PENDING_REVIEW",
    });
  }

  if (process.env.HEAD_COACH_SCOPE_DEBUG === "1") {
    const uid = options?.userId?.trim() ?? "";
    if (uid.length > 0) {
      try {
        const matchedActiveBatchCount = activeBatches.length;
        const matchedStudentCount = expectedCount;
        const sessionBranchId =
          typeof headCoachUserBranchId === "string" &&
          headCoachUserBranchId.trim() !== ""
            ? headCoachUserBranchId.trim()
            : null;

        const compare = await runHeadCoachCompareAudit(uid);
        if (!compare) {
          const missingPayload: Record<string, unknown> = {
            source: "dashboard",
            userId: uid,
            role: ROLE_HEAD_COACH,
            instituteId,
            sessionBranchId,
            dbBranchId: null,
            matchedActiveBatchCount,
            matchedStudentCount,
            instituteActiveBatchCount: null,
            branchActiveBatchCount: null,
            instituteStudentCount: null,
            branchStudentCount: null,
            nullBranchBatchCount: null,
            nullBranchStudentCount: null,
            note: "compare_audit_user_missing",
          };
          if (matchedActiveBatchCount === 0 || matchedStudentCount === 0) {
            try {
              const focused = await auditStaffUserTenantLinkage(uid);
              if (focused) missingPayload.legacyStaffFocusedAudit = focused;
            } catch {
              /* diagnostics only */
            }
          }
          debugLogHeadCoachScope(missingPayload);
        } else {
          const payload: Record<string, unknown> = {
            source: "dashboard",
            userId: uid,
            role: compare.role ?? ROLE_HEAD_COACH,
            instituteId: compare.instituteId ?? instituteId,
            sessionBranchId,
            dbBranchId: compare.branchId,
            matchedActiveBatchCount,
            matchedStudentCount,
            instituteActiveBatchCount: compare.instituteActiveBatchCount,
            branchActiveBatchCount: compare.branchActiveBatchCount,
            instituteStudentCount: compare.instituteStudentCount,
            branchStudentCount: compare.branchStudentCount,
            nullBranchBatchCount: compare.nullBranchBatchCount,
            nullBranchStudentCount: compare.nullBranchStudentCount,
          };
          if (matchedActiveBatchCount === 0 || matchedStudentCount === 0) {
            payload.compareAudit = compare;
            try {
              const focused = await auditStaffUserTenantLinkage(uid);
              if (focused) payload.legacyStaffFocusedAudit = focused;
            } catch {
              /* diagnostics only */
            }
          }
          debugLogHeadCoachScope(payload);
        }

        let totalActiveStudentsInInstitute = 0;
        try {
          totalActiveStudentsInInstitute = await prisma.student.count({
            where: { instituteId, status: "ACTIVE" },
          });
        } catch {
          /* diagnostics only */
        }

        const shouldAttachStudentLinkageSummary =
          totalActiveStudentsInInstitute > matchedStudentCount &&
          totalActiveStudentsInInstitute >= matchedStudentCount + 3;

        if (shouldAttachStudentLinkageSummary) {
          try {
            const [linkage, samples] = await Promise.all([
              compareAdminActiveStudentsToHeadCoachBranchScope(
                uid,
                instituteId,
                sessionBranchId,
              ),
              fetchStudentBranchLinkageDetailedSamples(instituteId, sessionBranchId),
            ]);
            debugLogStudentBranchAudit({
              ...linkage,
              matchedStudentCount,
              matchedBatchCount: matchedActiveBatchCount,
              samples,
            });
          } catch {
            /* diagnostics only */
          }
        } else {
          debugLogStudentBranchAudit({
            userId: uid,
            instituteId,
            branchId: sessionBranchId,
            matchedStudentCount,
            matchedBatchCount: matchedActiveBatchCount,
            totalActiveStudentsInInstitute,
          });
        }
      } catch {
        /* diagnostics only */
      }
    }
  }

  return {
    branchName: branchNameFallback,
    todayYmd,
    summary: {
      activeBatches: activeBatches.length,
      enrolledStudents: expectedCount,
      assistantCoachCount,
    },
    todayAttendance: {
      hasSubmission,
      presentCount: attendedTodayForRate,
      /** Active students in in-scope batches — same denominator as {@link getTodayAttendanceRatePercentScoped}. */
      expectedCount: expectedCountForTodayAttendanceRate,
      percent,
    },
    attentionStudents,
    batches,
    pendingActions,
    progressV2,
    progressAlerts,
    lowAttendanceAttentionCount,
  };
}
