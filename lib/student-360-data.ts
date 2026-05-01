import type { Prisma } from "@prisma/client";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { buildAttendanceScopeWhere } from "@/lib/authz-prisma-scopes";
import {
  aggregateAttendanceRows7d,
  attendanceAttendedRatePercent,
  type AttendanceRollup7d,
} from "@/lib/attendance-student-7d-aggregate";
import {
  formatCalendarYmdAsDdMmYyyy,
  formatCalendarYmdShortWeekday,
  formatInstantAsDdMmYyyy,
  getIndiaLastNCalendarDaysYmd,
} from "@/lib/datetime-india";
import { formatDobForDisplay } from "@/lib/dob-format";
import {
  isAbsentStatus,
  isAttendancePresentLike,
  parseAttendanceMarkStatus,
} from "@/lib/attendance-status";
import { prisma } from "@/lib/prisma";
import { progressAssessmentScopeWhere } from "@/lib/progress-assessment-access";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import {
  progressAssessmentListSelect,
  serializeProgressAssessmentListRow,
} from "@/lib/progress-assessment-payload";
import {
  attendanceRecordOperationallyVisible,
  progressAssessmentRecordOperationallyVisible,
  type AttendanceGuardrailRow,
  type ProgressAssessmentGuardrailRow,
} from "@/lib/tenant-integrity-guardrails";
import { formatAssessmentDateYmd } from "@/lib/progress-assessment-display";
import { getStudentReadiness } from "@/lib/progress-readiness";
import {
  indicatorDisplay,
  latestApprovedAssessment,
  PROGRESS_LATEST_APPROVED_ORDER_BY,
} from "@/lib/student-progress-assessment-helpers";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  ROLE_PARENT,
} from "@/lib/roles";
import { studentReviewListInclude } from "@/lib/student-review-payload";
import { buildStudentReviewListWhere } from "@/lib/student-review-scope";
import { getStudentByIdWithBatchForUser } from "@/lib/students-queries";

export type Student360AttendanceDayStrip = {
  ymd: string;
  label: string;
  /** 0–1 bar fill height for skeleton strip */
  barHeight: number;
  kind: "attended" | "absent" | "unmarked";
};

export type Student360FeedbackNoteVm = {
  note: string;
  authorLabel: string;
  dateLabel: string;
  title: string | null;
};

/** Visual hierarchy for the Actions card (one primary per role). */
export type Student360ActionTier = "primary" | "secondary" | "tertiary";

export type Student360ActionVm = {
  key: string;
  label: string;
  href: string | null;
  disabled: boolean;
  tier: Student360ActionTier;
};

export type Student360ViewModel = {
  identity: {
    fullName: string;
    monogram: string;
    readinessLabel: string;
    readinessBadgeClass: string;
    metaLine: string;
    batchLabel: string;
    branchLabel: string;
    /** Optional; omitted when not cleanly derivable */
    lastUpdatedLine: string | null;
  };
  summary: Array<{
    key: "attendance" | "progress" | "feedback" | "activity";
    label: string;
    value: string;
    hint: string;
  }>;
  attendance: {
    title: string;
    subtitle: string;
    ratePct: number | null;
    rollup: AttendanceRollup7d | null;
    weekStrip: Student360AttendanceDayStrip[];
  };
  progress: {
    title: string;
    subtitle: string;
    overallScore: string;
    indicatorLabel: string;
    scores: Array<{ label: string; value: string }>;
    latestLine: string;
  };
  feedback: {
    title: string;
    subtitle: string;
    primary: Student360FeedbackNoteVm | null;
    secondary: Student360FeedbackNoteVm | null;
    visibleReviewCount: number;
  };
  actions: Student360ActionVm[];
  quickFacts: Array<{ label: string; value: string }>;
  activity: {
    title: string;
    subtitle: string;
    items: Array<{
      title: string;
      detail: string;
      time: string;
      isLatest?: boolean;
    }>;
  };
};

function monogramFromFullName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase() || "?";
}

function authorLabelFromEmail(email: string | null | undefined): string {
  if (!email?.trim()) return "Coach";
  const local = email.trim().split("@")[0] ?? email;
  return local.length > 0 ? local : "Coach";
}

function formatReviewDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function dayStripKindForRows(
  rows: ReadonlyArray<{ status: string }>,
): "attended" | "absent" | "unmarked" {
  const marked = rows
    .map((r) => parseAttendanceMarkStatus(r.status))
    .filter((s): s is NonNullable<typeof s> => s !== null);
  if (marked.length === 0) return "unmarked";
  if (marked.some((s) => isAttendancePresentLike(s))) return "attended";
  if (marked.some((s) => isAbsentStatus(s))) return "absent";
  return "unmarked";
}

function buildWeekStrip(
  last7NewestFirst: string[],
  rows: ReadonlyArray<{ date: string; status: string }>,
): Student360AttendanceDayStrip[] {
  const byDate = new Map<string, { status: string }[]>();
  for (const r of rows) {
    const list = byDate.get(r.date) ?? [];
    list.push({ status: r.status });
    byDate.set(r.date, list);
  }
  const oldestFirst = [...last7NewestFirst].reverse();
  return oldestFirst.map((ymd) => {
    const dayRows = byDate.get(ymd) ?? [];
    const kind = dayStripKindForRows(dayRows);
    const barHeight =
      kind === "attended" ? 0.88 : kind === "absent" ? 0.32 : 0.14;
    return {
      ymd,
      label: formatCalendarYmdShortWeekday(ymd),
      barHeight,
      kind,
    };
  });
}

async function loadProgressListItems(
  user: SessionUserWithInstitute,
  studentId: string,
): Promise<ProgressAssessmentListItem[]> {
  if (user.role === ROLE_PARENT) {
    const candidates = await prisma.progressAssessment.findMany({
      where: {
        studentId,
        instituteId: user.instituteId,
        status: PROGRESS_ASSESSMENT_STATUS.APPROVED,
      },
      orderBy: PROGRESS_LATEST_APPROVED_ORDER_BY,
      take: 12,
      select: progressAssessmentListSelect,
    });
    const row = candidates.find((c) =>
      progressAssessmentRecordOperationallyVisible(c as ProgressAssessmentGuardrailRow),
    );
    if (!row) return [];
    return [
      serializeProgressAssessmentListRow(row) as ProgressAssessmentListItem,
    ];
  }

  const scopeWhere = await progressAssessmentScopeWhere(user);
  const sidIn = scopeWhere.studentId;
  if (
    typeof sidIn === "object" &&
    sidIn !== null &&
    "in" in sidIn &&
    Array.isArray(sidIn.in) &&
    sidIn.in.length === 0
  ) {
    return [];
  }

  const rows = await prisma.progressAssessment.findMany({
    where: { ...scopeWhere, studentId },
    orderBy: PROGRESS_LATEST_APPROVED_ORDER_BY,
    select: progressAssessmentListSelect,
  });
  return rows
    .filter((r) =>
      progressAssessmentRecordOperationallyVisible(r as ProgressAssessmentGuardrailRow),
    )
    .map((r) => serializeProgressAssessmentListRow(r) as ProgressAssessmentListItem);
}

function mapReviewToVm(r: {
  note: string;
  title: string | null;
  createdAt: Date;
  author: { email: string };
}): Student360FeedbackNoteVm {
  return {
    note: (r.note ?? "").trim(),
    title: r.title?.trim() || null,
    authorLabel: authorLabelFromEmail(r.author.email),
    dateLabel: formatReviewDate(new Date(r.createdAt)),
  };
}

/**
 * Role-aware actions using existing app routes only.
 * See AttendanceScreen (`batchId` query) and progress/review (no per-student filter in URL).
 */
function buildActions(
  studentId: string,
  role: string,
  batchId: string | null,
): Student360ActionVm[] {
  const classic = `/students/${studentId}`;
  const progressNewForStudent = `/progress/assessments/new?student=${encodeURIComponent(studentId)}`;
  const attendanceForBatch =
    batchId != null && batchId.trim() !== ""
      ? `/attendance?batchId=${encodeURIComponent(batchId.trim())}`
      : null;

  if (role === ROLE_PARENT) {
    return [
      {
        key: "progress_detail",
        label: "View detailed progress",
        href: `${classic}?tab=progress`,
        disabled: false,
        tier: "primary",
      },
      {
        key: "parent_home",
        label: "Parent home",
        href: "/parent",
        disabled: false,
        tier: "secondary",
      },
      {
        key: "classic",
        label: "View Profile",
        href: classic,
        disabled: false,
        tier: "tertiary",
      },
    ];
  }

  const isAssistant = role === ROLE_ASSISTANT_COACH;
  const isAdmin = role === ROLE_ADMIN;
  const isHead = role === ROLE_HEAD_COACH;

  if (isAssistant) {
    return [
      {
        key: "add_assessment",
        label: "New assessment",
        href: progressNewForStudent,
        disabled: false,
        tier: "primary",
      },
      {
        key: "mark_attendance",
        label: "Mark attendance",
        href: attendanceForBatch,
        disabled: attendanceForBatch == null,
        tier: "secondary",
      },
      {
        key: "classic",
        label: "View Profile",
        href: classic,
        disabled: false,
        tier: "tertiary",
      },
    ];
  }

  if (isHead) {
    return [
      {
        key: "review_progress",
        label: "Review progress",
        href: "/progress/review",
        disabled: false,
        tier: "primary",
      },
      {
        key: "staff_feedback",
        label: "Staff feedback",
        href: `${classic}#staff-feedback`,
        disabled: false,
        tier: "secondary",
      },
      {
        key: "classic",
        label: "View Profile",
        href: classic,
        disabled: false,
        tier: "tertiary",
      },
    ];
  }

  if (isAdmin) {
    return [
      {
        key: "reports",
        label: "View reports",
        href: "/reports",
        disabled: false,
        tier: "primary",
      },
      {
        key: "classic",
        label: "View Profile",
        href: classic,
        disabled: false,
        tier: "secondary",
      },
      {
        key: "review_progress",
        label: "Review progress",
        href: "/progress/review",
        disabled: false,
        tier: "tertiary",
      },
    ];
  }

  return [
    {
      key: "classic",
      label: "View Profile",
      href: classic,
      disabled: false,
      tier: "primary",
    },
  ];
}

export async function loadStudent360ViewModel(
  user: SessionUserWithInstitute,
  studentId: string,
): Promise<Student360ViewModel | null> {
  const isDev = process.env.NODE_ENV !== "production";
  const debug = (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  };

  const metaBase = {
    studentId,
    userId: user.id,
    role: user.role,
    instituteId: user.instituteId,
  };

  debug("[student-360][start]", metaBase);

  const row = await getStudentByIdWithBatchForUser(user, studentId);
  debug("[student-360][row]", {
    ...metaBase,
    branchId: user.branchId ?? null,
    scopePath: "getStudentByIdWithBatchForUser→buildStudentScopeWhere",
    rowFound: row != null,
    rowId: row?.id ?? null,
    batchId: row?.batchId ?? null,
  });
  if (process.env.READ_SCOPE_DEBUG === "1") {
    console.warn("[read-scope][student-360]", {
      ...metaBase,
      branchId: user.branchId ?? null,
      batchId: row?.batchId ?? null,
      scopePath: "getStudentByIdWithBatchForUser→buildStudentScopeWhere",
    });
  }
  if (!row) return null;

  const { student, attendanceWhere, reviewWhere, last7Ymds } =
    await (async () => {
      try {
        const batchExtras =
          row.batchId != null
            ? await prisma.batch.findFirst({
                where: { id: row.batchId, instituteId: user.instituteId },
                select: {
                  branch: { select: { name: true } },
                  coach: { select: { fullName: true } },
                },
              })
            : null;

        const student = {
          ...row,
          batch:
            row.batch == null
              ? null
              : {
                  ...row.batch,
                  branch: batchExtras?.branch ?? null,
                  coach: batchExtras?.coach ?? null,
                },
        };

        const attendanceScope = await buildAttendanceScopeWhere(user);
        const last7Ymds = getIndiaLastNCalendarDaysYmd(new Date(), 7);

        const attendanceWhere: Prisma.AttendanceWhereInput = {
          AND: [attendanceScope, { studentId }, { date: { in: last7Ymds } }],
        };

        /** Same filter as `GET /api/students/[id]/reviews` (scope + parent visibility). */
        const reviewWhere = await buildStudentReviewListWhere(user, studentId);

        return { student, attendanceWhere, reviewWhere, last7Ymds };
      } catch (error) {
        if (isDev) {
          console.error("[student-360][transform][error]", {
            ...metaBase,
            phase: "postRowSetup",
            message: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    })();

  const [attOutcome, progressOutcome, reviewsOutcome] = await Promise.all([
    (async () => {
      debug("[student-360][attendance][before]", metaBase);
      try {
        const attRowsRaw = await prisma.attendance.findMany({
          where: attendanceWhere,
          select: {
            date: true,
            status: true,
            instituteId: true,
            batchId: true,
            studentId: true,
            student: {
              select: {
                instituteId: true,
                batchId: true,
                batch: {
                  select: {
                    instituteId: true,
                    branchId: true,
                    branch: { select: { instituteId: true } },
                  },
                },
              },
            },
            batch: {
              select: {
                instituteId: true,
                branchId: true,
                branch: { select: { instituteId: true } },
              },
            },
          },
        });
        const attRows = attRowsRaw
          .filter((r) =>
            attendanceRecordOperationallyVisible(r as AttendanceGuardrailRow),
          )
          .map((r) => ({ date: r.date, status: r.status }));
        const rollup = aggregateAttendanceRows7d(attRows);
        const ratePct = attendanceAttendedRatePercent(rollup);
        const weekStrip = buildWeekStrip(last7Ymds, attRows);
        debug("[student-360][attendance][after]", {
          ...metaBase,
          attRowCount: attRows.length,
        });
        return { attRows, rollup, ratePct, weekStrip };
      } catch (error) {
        if (isDev) {
          console.error("[student-360][attendance][error]", {
            ...metaBase,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    })(),
    (async () => {
      debug("[student-360][progress][before]", metaBase);
      try {
        const assessments = await loadProgressListItems(user, studentId);
        const readiness = getStudentReadiness(assessments);
        const latestApproved = latestApprovedAssessment(assessments);
        debug("[student-360][progress][after]", {
          ...metaBase,
          assessmentCount: assessments.length,
        });
        return { assessments, readiness, latestApproved };
      } catch (error) {
        if (isDev) {
          console.error("[student-360][progress][error]", {
            ...metaBase,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    })(),
    (async () => {
      debug("[student-360][reviews][before]", metaBase);
      try {
        const [reviewRows, reviewTotalCount] = await Promise.all([
          prisma.studentReview.findMany({
            where: reviewWhere,
            orderBy: { createdAt: "desc" },
            take: 3,
            include: studentReviewListInclude,
          }),
          prisma.studentReview.count({ where: reviewWhere }),
        ]);
        debug("[student-360][reviews][after]", {
          ...metaBase,
          reviewRowCount: reviewRows.length,
          reviewTotalCount,
        });
        return { reviewRows, reviewTotalCount };
      } catch (error) {
        if (isDev) {
          console.error("[student-360][reviews][error]", {
            ...metaBase,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    })(),
  ]);

  const { attRows, rollup, ratePct, weekStrip } = attOutcome;
  const { readiness, latestApproved } = progressOutcome;
  const { reviewRows, reviewTotalCount } = reviewsOutcome;

  debug("[student-360][transform][before]", {
    ...metaBase,
    attRowCount: attRows.length,
    assessmentCount: progressOutcome.assessments.length,
    reviewRowCount: reviewRows.length,
    reviewTotalCount,
  });
  let vm: Student360ViewModel;
  try {
    const batchLabel =
      student.batchId && student.batch
        ? student.batch.name?.trim() || "Untitled batch"
        : "Unassigned";
    const branchLabel = student.batch?.branch?.name?.trim() || "—";

    const gender = student.gender?.trim() || "—";
    const dobDisplay = formatDobForDisplay(student.dob);
    const statusDisplay =
      (student.status ?? "").toUpperCase() === "ACTIVE" ? "Active" : "Inactive";
    const metaLine = `${gender} · DOB ${dobDisplay} · ${statusDisplay}`;

    const lastUpdatedLine = `Record updated · ${formatInstantAsDdMmYyyy(student.updatedAt)}`;

    const attendanceSummaryValue =
      ratePct != null ? `${ratePct}%` : rollup ? "—" : "No marks";
    const attendanceHint =
      ratePct != null
        ? "Rolling 7-day window (India calendar)"
        : "No marks in the last 7 India calendar days";

    let progressValue = "—";
    let progressHint = "No approved assessment in view";
    if (latestApproved) {
      progressValue = indicatorDisplay(latestApproved.assessmentIndicator);
      if (latestApproved.overallScore != null) {
        progressHint = `Overall ${latestApproved.overallScore}/10 · ${indicatorDisplay(latestApproved.assessmentIndicator)}`;
      } else {
        progressHint = `Latest approved · ${indicatorDisplay(latestApproved.assessmentIndicator)}`;
      }
    }

    const visibleReviewCount = reviewTotalCount;
    let feedbackValue = "—";
    let feedbackHint = "No notes in your visibility";
    if (visibleReviewCount > 0) {
      feedbackValue = `${visibleReviewCount} note${visibleReviewCount === 1 ? "" : "s"}`;
      feedbackHint =
        user.role === ROLE_PARENT
          ? "Published notes shared with parents"
          : "All reviews for this student (same as classic profile)";
    }

    let activityValue = "—";
    let activityHint =
      "None from 7-day attendance (India calendar), approved progress, or feedback on this page";
    const datedCandidates: Date[] = [];
    if (latestApproved?.assessmentDate) {
      datedCandidates.push(new Date(latestApproved.assessmentDate));
    }
    if (reviewRows[0]?.createdAt) {
      datedCandidates.push(new Date(reviewRows[0]!.createdAt));
    }
    const sortedAttYmds = attRows.map((r) => r.date).sort();
    const latestAtt =
      sortedAttYmds.length > 0
        ? sortedAttYmds[sortedAttYmds.length - 1]!
        : undefined;
    if (latestAtt) {
      const [y, m, d] = latestAtt.split("-").map(Number);
      if (y && m && d) datedCandidates.push(new Date(Date.UTC(y, m - 1, d)));
    }
    const bestActivity =
      datedCandidates.length > 0
        ? datedCandidates.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b))
        : null;
    if (bestActivity && !Number.isNaN(bestActivity.getTime())) {
      activityValue = formatReviewDate(bestActivity);
      activityHint =
        "Latest among 7-day attendance (India), approved progress date, and feedback on this page — not full history";
    }

    const primaryReview = reviewRows[0];
    const secondaryReview = user.role === ROLE_PARENT ? null : reviewRows[1];

    const primaryFeedbackVm = primaryReview?.note.trim()
      ? mapReviewToVm(primaryReview)
      : null;
    const secondaryFeedbackVm = secondaryReview?.note.trim()
      ? mapReviewToVm(secondaryReview)
      : null;

    const latestAssessmentYmd = latestApproved
      ? formatAssessmentDateYmd(latestApproved.assessmentDate)
      : null;
    const latestLine =
      latestApproved && latestAssessmentYmd
        ? `Assessment dated ${formatCalendarYmdAsDdMmYyyy(latestAssessmentYmd)} · approved (Progress V2)`
        : "No approved assessment in your current view.";

    const scoreCell = (n: number | null) =>
      n != null && Number.isFinite(n) ? String(n) : "—";

    const activityItems: Student360ViewModel["activity"]["items"] = [
      {
        title: "Profile record",
        detail: "Last update timestamp from the student directory",
        time: formatInstantAsDdMmYyyy(student.updatedAt),
        isLatest: true,
      },
    ];
    if (latestAssessmentYmd) {
      activityItems.push({
        title: "Latest approved assessment",
        detail: `Progress V2 · ${formatCalendarYmdAsDdMmYyyy(latestAssessmentYmd)}`,
        time: formatCalendarYmdAsDdMmYyyy(latestAssessmentYmd),
      });
    }
    if (reviewRows[0]) {
      activityItems.push({
        title: "Latest coach feedback",
        detail: primaryFeedbackVm?.note.slice(0, 80) ?? "",
        time: formatReviewDate(new Date(reviewRows[0]!.createdAt)),
      });
    }

    const quickFacts: Array<{ label: string; value: string }> = [
      {
        label: "Assigned coach",
        value: student.batch?.coach?.fullName?.trim() || "—",
      },
      { label: "Batch", value: batchLabel },
      { label: "Branch", value: branchLabel },
      { label: "Joined", value: formatInstantAsDdMmYyyy(student.joiningDate) },
    ];

    vm = {
      identity: {
        fullName: (student.fullName ?? "").trim(),
        monogram: monogramFromFullName(student.fullName),
        readinessLabel: readiness.label,
        readinessBadgeClass: readiness.badgeClass,
        metaLine,
        batchLabel,
        branchLabel,
        lastUpdatedLine,
      },
      summary: [
        {
          key: "attendance",
          label: "Attendance",
          value: attendanceSummaryValue,
          hint: attendanceHint,
        },
        {
          key: "progress",
          label: "Progress status",
          value: progressValue,
          hint: progressHint,
        },
        {
          key: "feedback",
          label: "Coach feedback",
          value: feedbackValue,
          hint: feedbackHint,
        },
        {
          key: "activity",
          label: "Recent activity",
          value: activityValue,
          hint: activityHint,
        },
      ],
      attendance: {
        title: "Attendance",
        subtitle: "India calendar · last 7 days in your attendance scope",
        ratePct,
        rollup,
        weekStrip,
      },
      progress: {
        title: "Progress",
        subtitle: "Latest approved assessment (Progress V2)",
        overallScore:
          latestApproved?.overallScore != null
            ? String(latestApproved.overallScore)
            : "—",
        indicatorLabel: latestApproved
          ? indicatorDisplay(latestApproved.assessmentIndicator)
          : "—",
        scores: [
          {
            label: "Strength",
            value: scoreCell(latestApproved?.strengthScore ?? null),
          },
          {
            label: "Flexibility",
            value: scoreCell(latestApproved?.flexibilityScore ?? null),
          },
          {
            label: "Technique",
            value: scoreCell(latestApproved?.techniqueScore ?? null),
          },
          {
            label: "Discipline",
            value: scoreCell(latestApproved?.disciplineScore ?? null),
          },
        ],
        latestLine,
      },
      feedback: {
        title: "Feedback",
        subtitle:
          user.role === ROLE_PARENT
            ? "Published coach notes shared with parents"
            : "Coach notes (draft and published; internal and parent-visible)",
        primary: primaryFeedbackVm,
        secondary: secondaryFeedbackVm,
        visibleReviewCount,
      },
      actions: buildActions(studentId, user.role, student.batchId ?? null),
      quickFacts,
      activity: {
        title: "Recent activity",
        subtitle:
          "From recent attendance (7 India-calendar days), approved progress, and feedback on this page — not a full timeline",
        items: activityItems,
      },
    };
  } catch (error) {
    if (isDev) {
      console.error("[student-360][transform][error]", {
        ...metaBase,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }

  debug("[student-360][transform][after]", {
    ...metaBase,
    summaryCount: vm.summary.length,
    activityItemCount: vm.activity.items.length,
    actionCount: vm.actions.length,
  });
  debug("[student-360][return]", metaBase);
  return vm;
}
