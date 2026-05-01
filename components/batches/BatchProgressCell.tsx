"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/progress/StatusBadge";
import type { DerivedBatchStudentProgress } from "@/lib/batch-progress-derive";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import { formatAssessmentDateYmd } from "@/lib/progress-assessment-display";
import { getReadinessFromAssessment } from "@/lib/progress-readiness";
import {
  PROGRESS_ALERT_TYPE,
  progressAlertLabel,
  type ProgressAlertType,
} from "@/lib/progress-alerts";
import { READINESS_LEVEL } from "@/lib/progress-readiness";
import { Plus } from "lucide-react";

const INDICATOR_LABELS: Record<string, string> = {
  ON_TRACK: "On track",
  NEEDS_ATTENTION: "Needs attention",
  EXCELLING: "Excelling",
};

function indicatorLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return INDICATOR_LABELS[code] ?? code;
}

function studentsListHrefForPrimaryAlert(primary: ProgressAlertType): string {
  if (primary === PROGRESS_ALERT_TYPE.NEEDS_WORK) {
    return `/students?readiness=${READINESS_LEVEL.NEEDS_WORK}`;
  }
  return `/students?alert=${encodeURIComponent(primary)}`;
}

export function BatchProgressCell({
  derived,
  isAssistant,
  disabled,
  onOpenProgress,
  onAddProgress,
  progressAlerts,
}: {
  derived: DerivedBatchStudentProgress;
  isAssistant: boolean;
  disabled?: boolean;
  onOpenProgress: () => void;
  onAddProgress: () => void;
  /** Highest-priority operational flag; title lists all active flags. */
  progressAlerts?: { types: ProgressAlertType[]; primary: ProgressAlertType | null } | null;
}) {
  const { latestApproved, hasPendingReview, needsRevisionHighlight } = derived;
  const readiness = getReadinessFromAssessment(latestApproved);

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      {progressAlerts?.primary ? (
        <Link
          href={studentsListHrefForPrimaryAlert(progressAlerts.primary)}
          className="block px-1 text-[10px] font-semibold leading-tight text-amber-900 underline-offset-2 hover:underline"
          title={progressAlerts.types.map((t) => progressAlertLabel(t)).join(" · ")}
        >
          {progressAlertLabel(progressAlerts.primary)}
          {progressAlerts.types.length > 1 ? (
            <span className="font-normal text-slate-500"> +{progressAlerts.types.length - 1}</span>
          ) : null}
        </Link>
      ) : null}
      <div className="flex gap-2 px-1">
        <Link
          href={`/students?readiness=${encodeURIComponent(readiness.level)}`}
          className="origin-left shrink-0 scale-90 pt-0.5"
          aria-label={`View students with ${readiness.label} readiness`}
        >
          <span className={readiness.badgeClass}>{readiness.label}</span>
        </Link>
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenProgress}
          className="min-w-0 flex-1 rounded-lg border border-transparent py-1 text-left transition hover:border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {latestApproved ? (
            <p className="text-xs leading-snug text-slate-800">
              <span className="mt-0.5 block">
                <span className="font-semibold tabular-nums text-slate-900">
                  Overall {latestApproved.overallScore ?? "—"}
                </span>
                {latestApproved.overallScore != null ? (
                  <span className="font-normal text-slate-500">/10</span>
                ) : null}
                {indicatorLabel(latestApproved.assessmentIndicator) ? (
                  <span className="text-slate-600">
                    {" "}
                    · {indicatorLabel(latestApproved.assessmentIndicator)}
                  </span>
                ) : null}
              </span>
              <span className="block text-[11px] text-slate-500">
                {formatAssessmentDateYmd(latestApproved.assessmentDate)}
              </span>
            </p>
          ) : (
            <p className="text-xs text-slate-800">
              <span className="text-slate-500">No approved progress</span>
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {hasPendingReview ? (
              <span className="origin-left scale-90">
                <StatusBadge status={PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW} />
              </span>
            ) : null}
            {needsRevisionHighlight ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800 ring-1 ring-red-200">
                Revision
              </span>
            ) : null}
          </div>
        </button>
      </div>

      {isAssistant ? (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onAddProgress();
          }}
          className="inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-50 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          Add progress
        </button>
      ) : null}
    </div>
  );
}
