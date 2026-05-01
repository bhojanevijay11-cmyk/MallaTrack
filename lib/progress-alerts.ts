import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import { READINESS_LEVEL, getStudentReadiness } from "@/lib/progress-readiness";

/** Calendar days after which the latest approved assessment is considered stale (V1). */
export const STALE_PROGRESS_DAYS = 30;

export const PROGRESS_ALERT_TYPE = {
  PENDING_REVIEW: "PENDING_REVIEW",
  NEEDS_REVISION: "NEEDS_REVISION",
  NEEDS_WORK: "NEEDS_WORK",
  NO_PROGRESS: "NO_PROGRESS",
  STALE_PROGRESS: "STALE_PROGRESS",
  /** Head coach branch attention: low attended rate (last 7 days); not from ProgressAssessment rows. */
  LOW_ATTENDANCE: "LOW_ATTENDANCE",
  /** Coach review: DRAFT + parent-visible; not derived from ProgressAssessment. */
  PENDING_COACH_FEEDBACK: "PENDING_COACH_FEEDBACK",
} as const;

export type ProgressAlertType = (typeof PROGRESS_ALERT_TYPE)[keyof typeof PROGRESS_ALERT_TYPE];

export type ProgressAlertViewer =
  | { kind: "head_coach" | "admin" }
  | { kind: "assistant"; userId: string };

export type ProgressAlertAssessment = Pick<
  ProgressAssessmentListItem,
  "studentId" | "status" | "overallScore" | "assessmentDate" | "createdAt" | "authorUserId"
>;

export type ProgressAlertCounts = {
  pendingReview: number;
  /** Distinct students with DRAFT + parent-visible staff feedback (see progress-alerts-queries). */
  pendingCoachFeedbackDrafts: number;
  needsRevision: number;
  /** Assistant-authored assessments still in DRAFT (row count, not distinct students). */
  draftProgress: number;
  needsWork: number;
  noProgress: number;
  staleProgress: number;
};

export type StudentProgressAlerts = {
  studentId: string;
  types: ProgressAlertType[];
  primary: ProgressAlertType | null;
};

const PRIORITY: Record<ProgressAlertType, number> = {
  [PROGRESS_ALERT_TYPE.PENDING_REVIEW]: 1,
  [PROGRESS_ALERT_TYPE.NEEDS_REVISION]: 2,
  [PROGRESS_ALERT_TYPE.NEEDS_WORK]: 3,
  [PROGRESS_ALERT_TYPE.NO_PROGRESS]: 4,
  [PROGRESS_ALERT_TYPE.STALE_PROGRESS]: 5,
  [PROGRESS_ALERT_TYPE.LOW_ATTENDANCE]: 6,
  [PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK]: 7,
};

const LABELS: Record<ProgressAlertType, string> = {
  [PROGRESS_ALERT_TYPE.PENDING_REVIEW]: "Pending review",
  [PROGRESS_ALERT_TYPE.NEEDS_REVISION]: "Needs revision",
  [PROGRESS_ALERT_TYPE.NEEDS_WORK]: "Needs work",
  [PROGRESS_ALERT_TYPE.NO_PROGRESS]: "No approved progress",
  [PROGRESS_ALERT_TYPE.STALE_PROGRESS]: "Stale progress",
  [PROGRESS_ALERT_TYPE.LOW_ATTENDANCE]: "Low attendance",
  [PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK]: "Pending staff feedback",
};

const SHORT_LABELS: Record<ProgressAlertType, string> = {
  [PROGRESS_ALERT_TYPE.PENDING_REVIEW]: "Review",
  [PROGRESS_ALERT_TYPE.NEEDS_REVISION]: "Revise",
  [PROGRESS_ALERT_TYPE.NEEDS_WORK]: "Work",
  [PROGRESS_ALERT_TYPE.NO_PROGRESS]: "None",
  [PROGRESS_ALERT_TYPE.STALE_PROGRESS]: "Stale",
  [PROGRESS_ALERT_TYPE.LOW_ATTENDANCE]: "Attendance",
  [PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK]: "Staff FB",
};

export function progressAlertLabel(type: ProgressAlertType): string {
  return LABELS[type];
}

export function progressAlertShortLabel(type: ProgressAlertType): string {
  return SHORT_LABELS[type];
}

export function pickPrimaryAlert(types: ReadonlyArray<ProgressAlertType>): ProgressAlertType | null {
  if (types.length === 0) return null;
  let best = types[0]!;
  let bestP = PRIORITY[best];
  for (let i = 1; i < types.length; i++) {
    const t = types[i]!;
    const p = PRIORITY[t];
    if (p < bestP) {
      best = t;
      bestP = p;
    }
  }
  return best;
}

function sortAlertsByPriority(types: ProgressAlertType[]): ProgressAlertType[] {
  return [...types].sort((a, b) => PRIORITY[a] - PRIORITY[b]);
}

function parseYmdToUtcMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return Date.UTC(y, mo - 1, d);
}

/** True if calendar date is strictly more than STALE_PROGRESS_DAYS before `now` (UTC midnight comparison). */
export function isApprovedAssessmentStale(assessmentDateYmd: string, now: Date): boolean {
  const t = parseYmdToUtcMs(assessmentDateYmd);
  if (t == null) return false;
  const nowYmd = now.toISOString().slice(0, 10);
  const nowMs = parseYmdToUtcMs(nowYmd);
  if (nowMs == null) return false;
  const days = Math.floor((nowMs - t) / 86_400_000);
  return days > STALE_PROGRESS_DAYS;
}

function newestApprovedFirst(rows: ProgressAlertAssessment[]): ProgressAlertAssessment[] {
  return [...rows].filter((a) => a.status === PROGRESS_ASSESSMENT_STATUS.APPROVED).sort((a, b) => {
    const byDate = b.assessmentDate.localeCompare(a.assessmentDate);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Derives alert flags for one student from their assessments (already scoped to that student).
 * Pending/revision respect assistant authorship when viewer is assistant.
 */
export function getStudentAlerts(
  assessments: ReadonlyArray<ProgressAlertAssessment>,
  viewer: ProgressAlertViewer,
  options?: { now?: Date },
): { types: ProgressAlertType[]; primary: ProgressAlertType | null } {
  const now = options?.now ?? new Date();
  const all = [...assessments];
  const owned =
    viewer.kind === "assistant"
      ? all.filter((a) => a.authorUserId === viewer.userId)
      : all;

  const workflowScope = viewer.kind === "assistant" ? owned : all;

  const types: ProgressAlertType[] = [];

  if (workflowScope.some((a) => a.status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW)) {
    types.push(PROGRESS_ALERT_TYPE.PENDING_REVIEW);
  }
  if (workflowScope.some((a) => a.status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION)) {
    types.push(PROGRESS_ALERT_TYPE.NEEDS_REVISION);
  }

  const hasApprovedAny = all.some((a) => a.status === PROGRESS_ASSESSMENT_STATUS.APPROVED);

  const readinessSource = viewer.kind === "assistant" ? owned : all;
  const readiness = getStudentReadiness(readinessSource);
  /**
   * Align with Progress V2 readiness and `/students?readiness=NEEDS_WORK`: latest approved maps to
   * the band, and students with no approved assessment count as Needs Work there too.
   */
  if (readiness.level === READINESS_LEVEL.NEEDS_WORK) {
    types.push(PROGRESS_ALERT_TYPE.NEEDS_WORK);
  }

  if (!hasApprovedAny) {
    types.push(PROGRESS_ALERT_TYPE.NO_PROGRESS);
  } else {
    const latestApproved = newestApprovedFirst(all)[0];
    if (latestApproved && isApprovedAssessmentStale(latestApproved.assessmentDate, now)) {
      types.push(PROGRESS_ALERT_TYPE.STALE_PROGRESS);
    }
  }

  const sorted = sortAlertsByPriority(types);
  return { types: sorted, primary: pickPrimaryAlert(sorted) };
}

export function getBatchAlerts(
  students: ReadonlyArray<{ id: string }>,
  assessments: ReadonlyArray<ProgressAlertAssessment>,
  viewer: ProgressAlertViewer,
  options?: { now?: Date },
): StudentProgressAlerts[] {
  const byStudent = new Map<string, ProgressAlertAssessment[]>();
  for (const a of assessments) {
    const cur = byStudent.get(a.studentId) ?? [];
    cur.push(a);
    byStudent.set(a.studentId, cur);
  }

  return students.map((s) => {
    const rows = byStudent.get(s.id) ?? [];
    const { types, primary } = getStudentAlerts(rows, viewer, options);
    return { studentId: s.id, types, primary };
  });
}

export function emptyProgressAlertCounts(): ProgressAlertCounts {
  return {
    pendingReview: 0,
    pendingCoachFeedbackDrafts: 0,
    needsRevision: 0,
    draftProgress: 0,
    needsWork: 0,
    noProgress: 0,
    staleProgress: 0,
  };
}

/** Counts distinct students that have each alert type (a student may contribute to multiple buckets). */
export function getAlertCountsByType(
  students: ReadonlyArray<{ id: string }>,
  assessments: ReadonlyArray<ProgressAlertAssessment>,
  viewer: ProgressAlertViewer,
  options?: { now?: Date },
): ProgressAlertCounts {
  const batch = getBatchAlerts(students, assessments, viewer, options);
  const counts = emptyProgressAlertCounts();
  for (const row of batch) {
    if (row.types.includes(PROGRESS_ALERT_TYPE.PENDING_REVIEW)) counts.pendingReview += 1;
    if (row.types.includes(PROGRESS_ALERT_TYPE.NEEDS_REVISION)) counts.needsRevision += 1;
    if (row.types.includes(PROGRESS_ALERT_TYPE.NEEDS_WORK)) counts.needsWork += 1;
    if (row.types.includes(PROGRESS_ALERT_TYPE.NO_PROGRESS)) counts.noProgress += 1;
    if (row.types.includes(PROGRESS_ALERT_TYPE.STALE_PROGRESS)) counts.staleProgress += 1;
  }
  return counts;
}
