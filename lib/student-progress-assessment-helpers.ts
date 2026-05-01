import type { Prisma } from "@prisma/client";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import {
  PROGRESS_ACTIVE_ASSESSMENT_STATUSES,
  PROGRESS_ASSESSMENT_STATUS,
} from "@/lib/progress-assessment-constants";

/** DB ordering aligned with {@link latestApprovedAssessment} (assessmentDate, then createdAt). */
export const PROGRESS_LATEST_APPROVED_ORDER_BY: Prisma.ProgressAssessmentOrderByWithRelationInput[] =
  [{ assessmentDate: "desc" }, { createdAt: "desc" }];

const INDICATOR_LABELS: Record<string, string> = {
  ON_TRACK: "On track",
  NEEDS_ATTENTION: "Needs attention",
  EXCELLING: "Excelling",
};

export function latestApprovedAssessment(
  assessments: ProgressAssessmentListItem[],
): ProgressAssessmentListItem | null {
  const approved = assessments.filter((x) => x.status === PROGRESS_ASSESSMENT_STATUS.APPROVED);
  if (approved.length === 0) return null;
  const sorted = [...approved].sort((a, b) => {
    const byDate = (b.assessmentDate ?? "").localeCompare(a.assessmentDate ?? "");
    if (byDate !== 0) return byDate;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
  return sorted[0] ?? null;
}

const ACTIVE_STATUS_SET = new Set<string>(PROGRESS_ACTIVE_ASSESSMENT_STATUSES);

/**
 * Any non-approved assessment for the student (matches server single-active guard).
 * If multiple exist, returns the newest by assessment date (then createdAt), same ordering as API.
 */
export function pickActiveProgressAssessment(
  assessments: ProgressAssessmentListItem[],
): ProgressAssessmentListItem | null {
  const actives = assessments.filter((a) => ACTIVE_STATUS_SET.has(a.status));
  if (actives.length === 0) return null;
  if (actives.length === 1) return actives[0] ?? null;
  const sorted = [...actives].sort((a, b) => {
    const byDate = (b.assessmentDate ?? "").localeCompare(a.assessmentDate ?? "");
    if (byDate !== 0) return byDate;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
  return sorted[0] ?? null;
}

export function studentAssessmentPrimaryAction(studentId: string, active: ProgressAssessmentListItem | null): {
  label: string;
  href: string;
} {
  if (!active) {
    return {
      label: "Create Assessment",
      href: `/progress/assessments/new?student=${encodeURIComponent(studentId)}`,
    };
  }
  const href = `/progress/assessments/${encodeURIComponent(active.id)}`;
  if (active.status === PROGRESS_ASSESSMENT_STATUS.DRAFT) {
    return { label: "Continue Draft", href };
  }
  if (active.status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW) {
    return { label: "View Assessment", href };
  }
  if (active.status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION) {
    return { label: "Edit Assessment", href };
  }
  return {
    label: "Create Assessment",
    href: `/progress/assessments/new?student=${encodeURIComponent(studentId)}`,
  };
}

export function indicatorDisplay(code: string | null | undefined): string {
  if (!code) return "—";
  return INDICATOR_LABELS[code] ?? code;
}
