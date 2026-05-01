"use client";

import { ChevronRight } from "lucide-react";
import { ListSkeleton } from "@/components/progress/ListSkeleton";
import { StatusBadge } from "@/components/progress/StatusBadge";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import {
  coachDisplayLabelFromUser,
  formatAssessmentDateYmd,
  scoreSummaryFromAssessment,
  submittedDateLabel,
} from "@/lib/progress-assessment-display";
import { indicatorDisplay } from "@/lib/student-progress-assessment-helpers";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";

export function ProgressReviewQueue({
  assessments,
  loading,
  error,
  onSelect,
  emptyMessage,
  queueVariant = "neutral",
}: {
  assessments: ProgressAssessmentListItem[];
  loading: boolean;
  error: string | null;
  onSelect: (a: ProgressAssessmentListItem) => void;
  emptyMessage: string;
  /** Visual emphasis for scan speed: pending queue vs revision tracking list. */
  queueVariant?: "pending" | "revision" | "neutral";
}) {
  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
    );
  }
  if (loading) {
    return <ListSkeleton rows={5} />;
  }
  if (assessments.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-4 text-center ring-1 ring-inset ring-emerald-100/80">
        <p className="text-sm font-medium text-emerald-900">{emptyMessage}</p>
        <p className="mt-1.5 text-xs text-emerald-800/80">You&apos;re all caught up.</p>
      </div>
    );
  }

  const rowShell =
    queueVariant === "pending"
      ? "border-amber-200/90 bg-gradient-to-br from-amber-50/50 via-white to-white shadow-sm ring-1 ring-amber-100/70 hover:border-amber-300/90 hover:ring-amber-200/90"
      : queueVariant === "revision"
        ? "border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80 hover:border-slate-300/90 hover:bg-slate-50/40"
        : "border-slate-200/90 bg-white shadow-sm ring-1 ring-transparent hover:border-sky-200/90 hover:bg-sky-50/35 hover:ring-sky-100/80";

  return (
    <ul className="space-y-2">
      {assessments.map((a) => {
        const categorySummary = scoreSummaryFromAssessment(a);
        const batchLabel = a.batch.name?.trim() || "—";
        const sessionDate = formatAssessmentDateYmd(a.assessmentDate);
        const submitted = submittedDateLabel(a.submittedAt);
        const coach = coachDisplayLabelFromUser(a.authorUser ?? null);
        const indicator = indicatorDisplay(a.assessmentIndicator);
        const overall =
          a.overallScore != null && Number.isFinite(a.overallScore)
            ? `${a.overallScore} / 10`
            : null;

        const pendingHighlight =
          a.status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW && queueVariant === "pending";

        const rowCtaLabel =
          a.status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW
            ? "Review"
            : a.status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION
              ? "Open"
              : "View";

        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect(a)}
              aria-label={`${rowCtaLabel}: ${a.student.fullName}`}
              className={`group flex w-full gap-2 rounded-xl border p-2.5 text-left transition sm:items-center sm:gap-3 sm:p-3 ${rowShell}`}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold leading-tight text-slate-900 sm:text-base">
                    {a.student.fullName}
                  </p>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {overall ? (
                      <span className="rounded-lg bg-amber-100/90 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-950 ring-1 ring-amber-200/80">
                        {overall}
                      </span>
                    ) : null}
                    <StatusBadge status={a.status} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-700 sm:text-xs">
                  {a.assessmentIndicator?.trim() ? (
                    <span
                      className={`font-semibold ${pendingHighlight ? "text-amber-950" : "text-slate-800"}`}
                    >
                      {indicator}
                    </span>
                  ) : null}
                  {categorySummary ? (
                    <span className="tabular-nums text-slate-600">Cat. {categorySummary}</span>
                  ) : null}
                </div>
                <dl className="grid gap-x-3 gap-y-0.5 text-[11px] text-slate-600 sm:grid-cols-2 sm:text-xs">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                    <dt className="font-semibold text-slate-500">Batch</dt>
                    <dd className="min-w-0 truncate font-medium text-slate-800">{batchLabel}</dd>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <dt className="font-semibold text-slate-500">Session</dt>
                    <dd className="tabular-nums text-slate-800">{sessionDate}</dd>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <dt className="font-semibold text-slate-500">Submitted</dt>
                    <dd className="tabular-nums text-slate-800">{submitted ?? "—"}</dd>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                    <dt className="font-semibold text-slate-500">By</dt>
                    <dd className="min-w-0 truncate text-slate-800" title={a.authorUser?.email}>
                      {coach}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 self-stretch border-l border-slate-100/90 pl-2 sm:pl-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-sky-800 opacity-90 group-hover:opacity-100">
                  {rowCtaLabel}
                </span>
                <ChevronRight
                  className="h-5 w-5 text-sky-700 transition group-hover:translate-x-0.5"
                  aria-hidden
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
