/** Progress V2 workflow — stored as strings (matches Prisma schema). */

export const PROGRESS_ASSESSMENT_STATUS = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  NEEDS_REVISION: "NEEDS_REVISION",
  APPROVED: "APPROVED",
} as const;

export type ProgressAssessmentStatusValue =
  (typeof PROGRESS_ASSESSMENT_STATUS)[keyof typeof PROGRESS_ASSESSMENT_STATUS];

export const PROGRESS_ASSESSMENT_STATUSES: readonly ProgressAssessmentStatusValue[] = [
  PROGRESS_ASSESSMENT_STATUS.DRAFT,
  PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW,
  PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION,
  PROGRESS_ASSESSMENT_STATUS.APPROVED,
];

/** Draft / review pipeline — blocks creating another assessment until APPROVED (or absent). */
export const PROGRESS_ACTIVE_ASSESSMENT_STATUSES = [
  PROGRESS_ASSESSMENT_STATUS.DRAFT,
  PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW,
  PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION,
] as const;

export const PROGRESS_PERIOD_TYPE = {
  ADHOC: "ADHOC",
  WEEK: "WEEK",
  MONTH: "MONTH",
} as const;

export type ProgressPeriodTypeValue =
  (typeof PROGRESS_PERIOD_TYPE)[keyof typeof PROGRESS_PERIOD_TYPE];

export const PROGRESS_PERIOD_TYPES: readonly ProgressPeriodTypeValue[] = [
  PROGRESS_PERIOD_TYPE.ADHOC,
  PROGRESS_PERIOD_TYPE.WEEK,
  PROGRESS_PERIOD_TYPE.MONTH,
];

export const PROGRESS_ASSESSMENT_INDICATOR = {
  ON_TRACK: "ON_TRACK",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
  EXCELLING: "EXCELLING",
} as const;

export type ProgressAssessmentIndicatorValue =
  (typeof PROGRESS_ASSESSMENT_INDICATOR)[keyof typeof PROGRESS_ASSESSMENT_INDICATOR];

export const PROGRESS_ASSESSMENT_INDICATORS: readonly ProgressAssessmentIndicatorValue[] = [
  PROGRESS_ASSESSMENT_INDICATOR.ON_TRACK,
  PROGRESS_ASSESSMENT_INDICATOR.NEEDS_ATTENTION,
  PROGRESS_ASSESSMENT_INDICATOR.EXCELLING,
];

export function parseProgressAssessmentStatus(value: unknown): ProgressAssessmentStatusValue | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return (PROGRESS_ASSESSMENT_STATUSES as readonly string[]).includes(s)
    ? (s as ProgressAssessmentStatusValue)
    : null;
}

export function parseProgressPeriodType(value: unknown): ProgressPeriodTypeValue | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return (PROGRESS_PERIOD_TYPES as readonly string[]).includes(s)
    ? (s as ProgressPeriodTypeValue)
    : null;
}

export function parseProgressAssessmentIndicator(
  value: unknown,
): ProgressAssessmentIndicatorValue | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  return (PROGRESS_ASSESSMENT_INDICATORS as readonly string[]).includes(s)
    ? (s as ProgressAssessmentIndicatorValue)
    : null;
}
