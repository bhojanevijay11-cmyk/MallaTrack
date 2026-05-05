import { StatusBadge } from "@/components/progress/StatusBadge";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import {
  formatAssessmentDateYmd,
  scoreSummaryFromAssessment,
} from "@/lib/progress-assessment-display";

export function ProgressRow({
  assessment,
  onSelect,
}: {
  assessment: ProgressAssessmentListItem;
  onSelect: () => void;
}) {
  const summary = scoreSummaryFromAssessment(assessment);
  const branchLoc = assessment.batch.branchName?.trim() || null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-col gap-2 rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-sm transition hover:border-amber-200/80 hover:bg-amber-50/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{assessment.student.fullName}</p>
        <p className="mt-0.5 text-sm text-slate-600">
          {formatAssessmentDateYmd(assessment.assessmentDate)}
        </p>
        {branchLoc ? (
          <p className="mt-0.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Branch:</span> {branchLoc}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {summary ? (
          <span className="text-xs tabular-nums text-slate-500">{summary}</span>
        ) : null}
        <StatusBadge status={assessment.status} />
      </div>
    </button>
  );
}
