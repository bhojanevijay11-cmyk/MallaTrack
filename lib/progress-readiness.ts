import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";

export const READINESS_LEVEL = {
  NEEDS_WORK: "NEEDS_WORK",
  DEVELOPING: "DEVELOPING",
  NEARLY_READY: "NEARLY_READY",
  COMPETITION_READY: "COMPETITION_READY",
} as const;

export type ReadinessLevel = (typeof READINESS_LEVEL)[keyof typeof READINESS_LEVEL];

export type ReadinessColorToken = "red" | "amber" | "blue" | "green";

export type ReadinessResult = {
  level: ReadinessLevel;
  label: string;
  colorToken: ReadinessColorToken;
  /** Compact pill classes aligned with existing small badges (e.g. batch “Revision”). */
  badgeClass: string;
};

const LABELS: Record<ReadinessLevel, string> = {
  [READINESS_LEVEL.NEEDS_WORK]: "Needs Work",
  [READINESS_LEVEL.DEVELOPING]: "Developing",
  [READINESS_LEVEL.NEARLY_READY]: "Nearly Ready",
  [READINESS_LEVEL.COMPETITION_READY]: "Competition Ready",
};

const COLOR_BY_LEVEL: Record<ReadinessLevel, ReadinessColorToken> = {
  [READINESS_LEVEL.NEEDS_WORK]: "red",
  [READINESS_LEVEL.DEVELOPING]: "amber",
  [READINESS_LEVEL.NEARLY_READY]: "blue",
  [READINESS_LEVEL.COMPETITION_READY]: "green",
};

const BADGE_BY_LEVEL: Record<ReadinessLevel, string> = {
  [READINESS_LEVEL.NEEDS_WORK]:
    "rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800 ring-1 ring-red-200",
  [READINESS_LEVEL.DEVELOPING]:
    "rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200",
  [READINESS_LEVEL.NEARLY_READY]:
    "rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-900 ring-1 ring-blue-200",
  [READINESS_LEVEL.COMPETITION_READY]:
    "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 ring-1 ring-emerald-200",
};

function readinessFromLevel(level: ReadinessLevel): ReadinessResult {
  return {
    level,
    label: LABELS[level],
    colorToken: COLOR_BY_LEVEL[level],
    badgeClass: BADGE_BY_LEVEL[level],
  };
}

/**
 * Map an approved overall score to a readiness band (V1).
 * Bands: below 4, 4 up to (but not including) 7, 7 up to 9, 9+ (covers non-integer scores without gaps).
 */
export function readinessLevelFromOverallScore(overallScore: number | null): ReadinessLevel {
  if (overallScore == null || !Number.isFinite(Number(overallScore))) {
    return READINESS_LEVEL.NEEDS_WORK;
  }
  const s = Number(overallScore);
  if (s < 4) return READINESS_LEVEL.NEEDS_WORK;
  if (s < 7) return READINESS_LEVEL.DEVELOPING;
  if (s < 9) return READINESS_LEVEL.NEARLY_READY;
  return READINESS_LEVEL.COMPETITION_READY;
}

type AssessmentReadinessFields = {
  status: string;
  overallScore: number | null;
};

/**
 * Derives readiness from a single assessment. Non-APPROVED or missing score → Needs Work.
 */
export function getReadinessFromAssessment(
  assessment: AssessmentReadinessFields | null | undefined,
): ReadinessResult {
  if (!assessment || assessment.status !== PROGRESS_ASSESSMENT_STATUS.APPROVED) {
    return readinessFromLevel(READINESS_LEVEL.NEEDS_WORK);
  }
  return readinessFromLevel(readinessLevelFromOverallScore(assessment.overallScore));
}

type AssessmentListEntry = AssessmentReadinessFields & {
  assessmentDate: string;
  createdAt: string;
};

/**
 * Latest APPROVED assessment by assessmentDate (then createdAt); same ordering as student/batch “latest approved”.
 * Empty or no approved rows → Needs Work.
 */
export function getStudentReadiness(assessments: ReadonlyArray<AssessmentListEntry>): ReadinessResult {
  const approved = assessments.filter((a) => a.status === PROGRESS_ASSESSMENT_STATUS.APPROVED);
  if (approved.length === 0) {
    return readinessFromLevel(READINESS_LEVEL.NEEDS_WORK);
  }
  const sorted = [...approved].sort((a, b) => {
    const byDate = (b.assessmentDate ?? "").localeCompare(a.assessmentDate ?? "");
    if (byDate !== 0) return byDate;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
  return getReadinessFromAssessment(sorted[0] ?? null);
}
