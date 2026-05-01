"use client";

import type { ReactNode } from "react";
import { AssessmentReviewScoreStrip } from "@/components/progress/AssessmentReviewScoreStrip";
import { StatusBadge } from "@/components/progress/StatusBadge";
import { ReviewActionBar } from "@/components/progress/review/ReviewActionBar";
import type { ProgressAssessmentDetailPayload } from "@/components/progress/review/progress-review-types";
import { formatAssessmentDateYmd } from "@/lib/progress-assessment-display";
import { overallScoreForDisplay } from "@/lib/progress-assessment-category-scores";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import { formatRepsSetsOrLegacy } from "@/lib/progress-assessment-exercise-metrics";

function ReadOnlyBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm leading-snug text-slate-900">{children}</div>
    </div>
  );
}

const INDICATOR_LABELS: Record<string, string> = {
  ON_TRACK: "On track",
  NEEDS_ATTENTION: "Needs attention",
  EXCELLING: "Excelling",
};

function modalChromeClass(status: string | undefined, reviewUi: boolean): string {
  if (!reviewUi || !status) return "";
  if (status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW) {
    return "ring-4 ring-amber-400/45 ring-offset-2 ring-offset-white";
  }
  if (status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION) {
    return "ring-2 ring-red-200/90";
  }
  if (status === PROGRESS_ASSESSMENT_STATUS.APPROVED) {
    return "ring-2 ring-emerald-200/90";
  }
  return "";
}

export function ProgressReviewDetail({
  detail,
  loading,
  error,
  onClose,
  onReviewFinished,
  showReviewActions = true,
  closeButtonLabel = "Close",
  onRetryLoad,
}: {
  detail: ProgressAssessmentDetailPayload | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onReviewFinished: (message: string) => void;
  /** When false, hides approve / request-correction controls (e.g. read-only from student profile). */
  showReviewActions?: boolean;
  /** Label for the header dismiss control (e.g. queue: "Back to progress review"). */
  closeButtonLabel?: string;
  /** When load fails, offer a safe retry without closing the modal. */
  onRetryLoad?: () => void;
}) {
  const showTopReviewActions =
    !!detail &&
    !loading &&
    showReviewActions &&
    detail.status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW;

  const headerTitle =
    showReviewActions && detail?.status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW
      ? "Review assessment"
      : "Assessment detail";

  const headerSubtitle = (() => {
    if (!showReviewActions) {
      return "Read-only — authors update this record from the Progress workspace when editing is allowed.";
    }
    const st = detail?.status;
    if (st === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW) {
      return "Read-only — approve or request revision using the controls below.";
    }
    if (st === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION) {
      return "Read-only — monitor this send-back until it is resubmitted for review.";
    }
    if (st === PROGRESS_ASSESSMENT_STATUS.APPROVED) {
      return "Read-only — approved and locked.";
    }
    return "Read-only detail.";
  })();

  const chrome = detail ? modalChromeClass(detail.status, showReviewActions) : "";

  const headerTone =
    detail &&
    showReviewActions &&
    detail.status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW
      ? "border-b border-amber-200/90 bg-gradient-to-r from-amber-50/90 to-white"
      : detail &&
          showReviewActions &&
          detail.status === PROGRESS_ASSESSMENT_STATUS.APPROVED
        ? "border-b border-emerald-100/90 bg-emerald-50/40"
        : detail &&
            showReviewActions &&
            detail.status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION
          ? "border-b border-red-100/90 bg-red-50/35"
          : "border-b border-slate-100";

  return (
    <div
      className={`flex max-h-[min(90dvh,720px)] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ${chrome}`}
    >
      <div className={`flex shrink-0 items-start justify-between gap-2 px-3 py-2 sm:px-4 ${headerTone}`}>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-800/90">
            {headerTitle}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{headerSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="touch-manipulation shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-white/80 hover:text-slate-900"
        >
          {closeButtonLabel}
        </button>
      </div>

      {showTopReviewActions && detail ? (
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-3 py-2 sm:px-4">
          <ReviewActionBar
            assessmentId={detail.id}
            status={detail.status}
            onReviewFinished={onReviewFinished}
            density="compact"
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4 sm:py-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8" aria-busy="true">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600"
              aria-hidden
            />
            <p className="text-sm text-slate-600">Loading assessment…</p>
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-200/90 bg-red-50/90 px-2.5 py-2 text-sm text-red-950">
            <p>{error}</p>
            {onRetryLoad ? (
              <button
                type="button"
                onClick={onRetryLoad}
                className="mt-2 inline-flex items-center justify-center rounded-lg border border-red-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-red-950 shadow-sm hover:bg-red-50"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {detail && !loading ? (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-2.5 shadow-sm sm:p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-tight text-slate-900 sm:text-lg">
                    {detail.student.fullName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={detail.status} />
                    {showReviewActions &&
                    detail.status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW ? (
                      <span className="rounded-full bg-amber-200/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                        Action needed
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-[11px] text-slate-600 sm:grid-cols-2 sm:text-xs">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  <dt className="shrink-0 font-semibold text-slate-500">Batch</dt>
                  <dd className="min-w-0 truncate font-medium text-slate-900">
                    {detail.batch.name?.trim() || "—"}
                  </dd>
                </div>
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  <dt className="shrink-0 font-semibold text-slate-500">Session</dt>
                  <dd className="tabular-nums font-medium text-slate-900">
                    {formatAssessmentDateYmd(detail.assessmentDate)}
                  </dd>
                </div>
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  <dt className="shrink-0 font-semibold text-slate-500">Period</dt>
                  <dd className="min-w-0 font-medium text-slate-900">{detail.periodType}</dd>
                </div>
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  <dt className="shrink-0 font-semibold text-slate-500">Author</dt>
                  <dd
                    className="min-w-0 truncate font-medium text-slate-900"
                    title={detail.authorUser.email ?? undefined}
                  >
                    {detail.authorUser.email?.trim() || "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  <dt className="shrink-0 font-semibold text-slate-500">Submitted</dt>
                  <dd className="min-w-0 font-medium text-slate-900">
                    {detail.submittedAt
                      ? `${formatAssessmentDateYmd(detail.submittedAt)} · ${detail.submittedByUser?.email?.trim() || "—"}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <AssessmentReviewScoreStrip
              compact
              strengthScore={detail.strengthScore}
              flexibilityScore={detail.flexibilityScore}
              techniqueScore={detail.techniqueScore}
              disciplineScore={detail.disciplineScore}
              overallScore={overallScoreForDisplay({
                strengthScore: detail.strengthScore,
                flexibilityScore: detail.flexibilityScore,
                techniqueScore: detail.techniqueScore,
                disciplineScore: detail.disciplineScore,
                storedOverallScore: detail.overallScore,
              })}
              indicatorLabel={
                detail.assessmentIndicator
                  ? INDICATOR_LABELS[detail.assessmentIndicator] ?? detail.assessmentIndicator
                  : "—"
              }
            />

            <ReadOnlyBlock label="Coach notes">
              {detail.coachNotes?.trim() ? (
                <span className="whitespace-pre-wrap">{detail.coachNotes}</span>
              ) : (
                "—"
              )}
            </ReadOnlyBlock>

            {detail.exercises?.length ? (
              <div className="border-t border-slate-100 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Exercises
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {detail.exercises.map((ex) => {
                    const target = formatRepsSetsOrLegacy(
                      ex.targetReps,
                      ex.targetSets,
                      ex.expectedPerformance,
                    );
                    const done = formatRepsSetsOrLegacy(
                      ex.completedReps,
                      ex.completedSets,
                      ex.observedPerformance,
                    );
                    return (
                      <li
                        key={ex.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/90 px-2.5 py-2 text-sm text-slate-900"
                      >
                        <p className="font-semibold leading-snug">{ex.exerciseName}</p>
                        <div className="mt-1.5 grid gap-1.5 text-xs sm:grid-cols-2">
                          <p className="rounded border border-sky-100/80 bg-sky-50/50 px-2 py-1 text-slate-800">
                            <span className="font-semibold text-sky-900/90">Target: </span>
                            <span className="tabular-nums">{target}</span>
                          </p>
                          <p className="rounded border border-emerald-100/80 bg-emerald-50/50 px-2 py-1 text-slate-800">
                            <span className="font-semibold text-emerald-900/90">Completed: </span>
                            <span className="tabular-nums">{done}</span>
                          </p>
                        </div>
                        {ex.note?.trim() ? (
                          <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-700">{ex.note.trim()}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {detail.reviewNote?.trim() ? (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-1.5 ring-1 ring-inset ring-amber-100">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">
                  Previous review note
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-amber-950">{detail.reviewNote}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
