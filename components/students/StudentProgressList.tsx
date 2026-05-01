"use client";

import { StatusBadge } from "@/components/progress/StatusBadge";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import {
  formatAssessmentDateYmd,
  scoreSummaryFromAssessment,
} from "@/lib/progress-assessment-display";
import { indicatorDisplay } from "@/lib/student-progress-assessment-helpers";

function notePreview(text: string | null | undefined, max = 96): string | null {
  const t = text?.trim();
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function StudentProgressList({
  assessments,
  onSelect,
  viewer,
}: {
  assessments: ProgressAssessmentListItem[];
  onSelect: (a: ProgressAssessmentListItem) => void;
  viewer: "assistant" | "readonly";
}) {
  return (
    <ul className="space-y-3">
      {assessments.map((a) => {
        const summary = scoreSummaryFromAssessment(a);
        const preview = notePreview(a.coachNotes);
        const feedbackPreview = notePreview(a.reviewNote, 120);
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect(a)}
              className="flex w-full flex-col gap-2 rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-sm transition hover:border-amber-200/80 hover:bg-amber-50/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatAssessmentDateYmd(a.assessmentDate)}
                  </p>
                  {preview ? (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{preview}</p>
                  ) : null}
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  {summary ? (
                    <span className="text-xs tabular-nums text-slate-500">{summary}</span>
                  ) : null}
                  <StatusBadge status={a.status} />
                </div>
              </div>
              {viewer === "assistant" &&
              a.status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION ? (
                <div className="rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-900">
                    Coach feedback (required changes)
                  </p>
                  <p className="mt-1 text-xs leading-snug text-red-950">
                    {feedbackPreview ??
                      "No written feedback was added. Check with your head coach for what to change."}
                  </p>
                </div>
              ) : null}
              {(viewer === "readonly" ||
                (viewer === "assistant" &&
                  a.status !== PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION)) &&
              feedbackPreview ? (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">
                    Previous review note
                  </p>
                  <p className="mt-1 text-xs leading-snug text-amber-950">{feedbackPreview}</p>
                </div>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export { latestApprovedAssessment, indicatorDisplay } from "@/lib/student-progress-assessment-helpers";
