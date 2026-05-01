import { prisma } from "@/lib/prisma";
import { formatRepsSetsOrLegacy } from "@/lib/progress-assessment-exercise-metrics";
import { overallScoreForDisplay } from "@/lib/progress-assessment-category-scores";
import {
  PROGRESS_ASSESSMENT_INDICATOR,
  PROGRESS_ASSESSMENT_STATUS,
} from "@/lib/progress-assessment-constants";
import {
  STUDENT_REVIEW_STATUS,
  STUDENT_REVIEW_VISIBILITY,
} from "@/lib/student-review-constants";
import { getIndiaLastNCalendarDaysYmd } from "@/lib/datetime-india";
import { aggregateAttendanceRows7d } from "@/lib/attendance-student-7d-aggregate";
import { attendanceRowsInstituteOrLegacyNull } from "@/lib/authz-prisma-scopes";
import { PROGRESS_LATEST_APPROVED_ORDER_BY } from "@/lib/student-progress-assessment-helpers";
import { progressAssessmentListSelect } from "@/lib/progress-assessment-payload";
import {
  attendanceRecordOperationallyVisible,
  operationalBatchWhereInput,
  operationalStudentWhereInput,
  progressAssessmentRecordOperationallyVisible,
  type AttendanceGuardrailRow,
  type ProgressAssessmentGuardrailRow,
} from "@/lib/tenant-integrity-guardrails";

function firstNameToken(fullName: string): string {
  const t = fullName.trim().split(/\s+/)[0];
  return t || fullName.trim() || "Student";
}

function humanizeIndicator(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    [PROGRESS_ASSESSMENT_INDICATOR.ON_TRACK]: "On track",
    [PROGRESS_ASSESSMENT_INDICATOR.NEEDS_ATTENTION]: "Needs attention",
    [PROGRESS_ASSESSMENT_INDICATOR.EXCELLING]: "Excelling",
  };
  return map[raw] ?? raw.replace(/_/g, " ").toLowerCase();
}

function formatScheduleLine(batch: {
  startTime: string | null;
  endTime: string | null;
} | null): string | null {
  if (!batch) return null;
  const a = batch.startTime?.trim() ?? "";
  const b = batch.endTime?.trim() ?? "";
  if (a && b) return `${a} – ${b}`;
  if (a) return a;
  if (b) return b;
  return null;
}

function formatAuthorLabel(email: string | null | undefined): string {
  if (!email?.trim()) return "Coach";
  const local = email.trim().split("@")[0] ?? email;
  return local.length > 0 ? local : "Coach";
}

function formatDateLabel(d: Date): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Last 7 India calendar days of attendance for one student; null if no rows in range. */
export type ParentAttendanceSummary7d = {
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendedCount: number;
};

/** One exercise row for parent-facing progress report (approved assessments only). */
export type ParentProgressExerciseRow = {
  exerciseName: string;
  targetLabel: string;
  completedLabel: string;
  /** Coach note for this exercise; may be trimmed in UI. */
  coachNote: string | null;
};

/**
 * Latest APPROVED progress assessment snapshot for a linked child.
 * Uses coach-authored `coachNotes` only (never reviewer `reviewNote` or non-approved rows).
 */
export type ParentLatestProgressReport = {
  assessmentId: string;
  overallScore: number | null;
  indicatorKey: string | null;
  indicatorLabel: string | null;
  lastUpdatedLabel: string;
  strengthScore: number | null;
  flexibilityScore: number | null;
  techniqueScore: number | null;
  disciplineScore: number | null;
  exercises: ParentProgressExerciseRow[];
  coachSummary: string | null;
};

export type ParentStudentDashboardBundle = {
  studentId: string;
  fullName: string;
  tabLabel: string;
  status: string;
  batchName: string | null;
  coachName: string | null;
  scheduleLine: string | null;
  /** Null when no attendance rows exist in the rolling last 7 India calendar days. */
  attendanceSummary: ParentAttendanceSummary7d | null;
  progressOverallScore: number | null;
  progressIndicatorLabel: string | null;
  highlight: {
    hasInsights: boolean;
    headline: string;
    subline: string | null;
  };
  /** Latest published coach review visible to parents (separate from progress assessments). */
  coachReview: {
    title: string | null;
    text: string;
    authorLabel: string;
    dateLabel: string;
  } | null;
  /** Latest APPROVED structured assessment for this student, or null. */
  latestProgressReport: ParentLatestProgressReport | null;
  sessionSummary: string | null;
  sessionFallback: boolean;
};

type ParentExerciseDbRow = {
  exerciseName: string;
  expectedPerformance: string | null;
  observedPerformance: string | null;
  note: string | null;
  targetReps: number | null;
  targetSets: number | null;
  completedReps: number | null;
  completedSets: number | null;
};

function mapExercisesForParentReport(exercises: ParentExerciseDbRow[]): ParentProgressExerciseRow[] {
  return exercises.map((e) => ({
    exerciseName: e.exerciseName.trim() || "Exercise",
    targetLabel: formatRepsSetsOrLegacy(e.targetReps, e.targetSets, e.expectedPerformance),
    completedLabel: formatRepsSetsOrLegacy(e.completedReps, e.completedSets, e.observedPerformance),
    coachNote: e.note?.trim() || null,
  }));
}

/**
 * Build parent-safe DTO from an APPROVED assessment row (operational guard already applied).
 * `coachSummary` comes from coach-authored notes only; reviewer notes are excluded.
 */
function buildParentLatestProgressReport(
  assessment: {
    id: string;
    assessmentDate: Date;
    strengthScore: number | null;
    flexibilityScore: number | null;
    techniqueScore: number | null;
    disciplineScore: number | null;
    overallScore: number | null;
    coachNotes: string | null;
    assessmentIndicator: string | null;
  },
  exercises: ParentExerciseDbRow[],
): ParentLatestProgressReport {
  const overallScore = overallScoreForDisplay({
    strengthScore: assessment.strengthScore,
    flexibilityScore: assessment.flexibilityScore,
    techniqueScore: assessment.techniqueScore,
    disciplineScore: assessment.disciplineScore,
    storedOverallScore: assessment.overallScore,
  });
  const coachSummary = assessment.coachNotes?.trim() || null;
  return {
    assessmentId: assessment.id,
    overallScore,
    indicatorKey: assessment.assessmentIndicator ?? null,
    indicatorLabel: humanizeIndicator(assessment.assessmentIndicator),
    lastUpdatedLabel: formatDateLabel(new Date(assessment.assessmentDate)),
    strengthScore: assessment.strengthScore,
    flexibilityScore: assessment.flexibilityScore,
    techniqueScore: assessment.techniqueScore,
    disciplineScore: assessment.disciplineScore,
    exercises: mapExercisesForParentReport(exercises),
    coachSummary,
  };
}

/**
 * Full APPROVED assessment for parent detail page. Enforces child linkage and operational guard.
 * Non-APPROVED or other parents' children → null (caller should 404).
 */
export async function getParentProgressAssessmentDetail(
  parentUserId: string,
  instituteId: string,
  assessmentId: string,
): Promise<ParentLatestProgressReport | null> {
  const aid = typeof assessmentId === "string" ? assessmentId.trim() : "";
  if (!aid) return null;

  const row = await prisma.progressAssessment.findFirst({
    where: {
      id: aid,
      instituteId,
      status: PROGRESS_ASSESSMENT_STATUS.APPROVED,
      student: { parentUserId, instituteId },
    },
    select: {
      ...progressAssessmentListSelect,
      exercises: {
        orderBy: { sortOrder: "asc" as const },
        select: {
          exerciseName: true,
          expectedPerformance: true,
          observedPerformance: true,
          note: true,
          targetReps: true,
          targetSets: true,
          completedReps: true,
          completedSets: true,
        },
      },
    },
  });

  if (!row) return null;
  if (!progressAssessmentRecordOperationallyVisible(row as ProgressAssessmentGuardrailRow)) {
    return null;
  }
  return buildParentLatestProgressReport(row, row.exercises);
}

async function bundleForStudent(
  s: {
    id: string;
    fullName: string;
    status: string;
    batch: {
      name: string | null;
      startTime: string | null;
      endTime: string | null;
      coach: { fullName: string | null } | null;
    } | null;
  },
  instituteId: string,
  attendanceSummary: ParentAttendanceSummary7d | null,
): Promise<ParentStudentDashboardBundle> {
  const batchName = s.batch?.name?.trim() || null;
  const coachName = s.batch?.coach?.fullName?.trim() || null;
  const scheduleLine = formatScheduleLine(s.batch);

  const [latestApprovedRaw, latestCoachReview] = await Promise.all([
    prisma.progressAssessment.findMany({
      where: {
        studentId: s.id,
        instituteId,
        status: PROGRESS_ASSESSMENT_STATUS.APPROVED,
      },
      orderBy: PROGRESS_LATEST_APPROVED_ORDER_BY,
      take: 12,
      select: progressAssessmentListSelect,
    }),
    prisma.studentReview.findFirst({
      where: {
        studentId: s.id,
        instituteId,
        status: STUDENT_REVIEW_STATUS.PUBLISHED,
        visibility: STUDENT_REVIEW_VISIBILITY.PARENT_VISIBLE,
      },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { email: true } } },
    }),
  ]);

  const latestApproved =
    latestApprovedRaw.find((r) =>
      progressAssessmentRecordOperationallyVisible(r as ProgressAssessmentGuardrailRow),
    ) ?? null;

  const progressOverallScore = latestApproved
    ? overallScoreForDisplay({
        strengthScore: latestApproved.strengthScore,
        flexibilityScore: latestApproved.flexibilityScore,
        techniqueScore: latestApproved.techniqueScore,
        disciplineScore: latestApproved.disciplineScore,
        storedOverallScore: latestApproved.overallScore,
      })
    : null;
  const progressIndicatorLabel = humanizeIndicator(
    latestApproved?.assessmentIndicator ?? null,
  );

  let latestProgressReport: ParentLatestProgressReport | null = null;
  if (latestApproved) {
    const exerciseRows = await prisma.progressAssessmentExercise.findMany({
      where: { assessmentId: latestApproved.id },
      orderBy: { sortOrder: "asc" },
      select: {
        exerciseName: true,
        expectedPerformance: true,
        observedPerformance: true,
        note: true,
        targetReps: true,
        targetSets: true,
        completedReps: true,
        completedSets: true,
      },
    });
    latestProgressReport = buildParentLatestProgressReport(latestApproved, exerciseRows);
  }

  let highlight: ParentStudentDashboardBundle["highlight"];
  if (progressOverallScore != null) {
    highlight = {
      hasInsights: true,
      headline: `${progressOverallScore}/10`,
      subline:
        progressIndicatorLabel ??
        "Latest approved progress assessment (overall score).",
    };
  } else if (latestApproved?.assessmentIndicator) {
    highlight = {
      hasInsights: true,
      headline: progressIndicatorLabel ?? "Progress update",
      subline: "From the latest approved assessment.",
    };
  } else {
    highlight = {
      hasInsights: false,
      headline: "Insights coming soon",
      subline:
        "When your coach publishes and approves a progress assessment, a summary will appear here.",
    };
  }

  let coachReview: ParentStudentDashboardBundle["coachReview"] = null;
  if (latestCoachReview) {
    const text = latestCoachReview.note.trim();
    if (text) {
      coachReview = {
        title: latestCoachReview.title?.trim() || null,
        text,
        authorLabel: formatAuthorLabel(latestCoachReview.author.email),
        dateLabel: formatDateLabel(new Date(latestCoachReview.createdAt)),
      };
    }
  }

  let sessionSummary: string | null = null;
  let sessionFallback = true;
  if (scheduleLine) {
    sessionSummary = `Typical schedule: ${scheduleLine}`;
    sessionFallback = false;
  } else if (batchName) {
    sessionSummary = `Batch: ${batchName}. Schedule not set in MallaTrack yet.`;
    sessionFallback = true;
  }

  return {
    studentId: s.id,
    fullName: s.fullName.trim(),
    tabLabel: firstNameToken(s.fullName),
    status: s.status,
    batchName,
    coachName,
    scheduleLine,
    attendanceSummary,
    progressOverallScore,
    progressIndicatorLabel,
    highlight,
    coachReview,
    latestProgressReport,
    sessionSummary,
    sessionFallback,
  };
}

/**
 * Linked students for a parent with dashboard-ready metrics (tenant-scoped).
 */
export async function getParentDashboardBundles(
  parentUserId: string,
  instituteId: string,
): Promise<ParentStudentDashboardBundle[]> {
  const students = await prisma.student.findMany({
    where: {
      parentUserId,
      instituteId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      status: true,
      batch: {
        select: {
          name: true,
          startTime: true,
          endTime: true,
          coach: { select: { fullName: true } },
        },
      },
    },
  });

  if (students.length === 0) return [];

  const studentIds = students.map((s) => s.id);
  const last7Ymds = getIndiaLastNCalendarDaysYmd(new Date(), 7);

  const attendanceRowsRaw = await prisma.attendance.findMany({
    where: {
      AND: [
        { studentId: { in: studentIds } },
        { date: { in: last7Ymds } },
        attendanceRowsInstituteOrLegacyNull(instituteId),
        {
          student: {
            AND: [
              { parentUserId, instituteId },
              operationalStudentWhereInput(instituteId),
            ],
          },
        },
        { batch: operationalBatchWhereInput(instituteId) },
      ],
    },
    select: {
      studentId: true,
      status: true,
      instituteId: true,
      batchId: true,
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

  const attendanceRows = attendanceRowsRaw.filter((r) =>
    attendanceRecordOperationallyVisible(r as AttendanceGuardrailRow),
  );

  const byStudent = new Map<string, { status: string }[]>();
  for (const r of attendanceRows) {
    const list = byStudent.get(r.studentId) ?? [];
    list.push({ status: r.status });
    byStudent.set(r.studentId, list);
  }

  return Promise.all(
    students.map((s) =>
      bundleForStudent(s, instituteId, aggregateAttendanceRows7d(byStudent.get(s.id) ?? [])),
    ),
  );
}
