"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import type { ProgressAlertCounts } from "@/lib/progress-alerts";

const shell =
  "rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm";

/**
 * Assistant coach dashboard: actionable revision count only (no institute-wide monitoring rows).
 */
export function CoachAttentionSummary({ counts }: { counts: ProgressAlertCounts }) {
  const draft = counts.draftProgress;
  const n = counts.needsRevision;

  return (
    <section className={shell}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Your assessments
      </h2>
      <p className="mt-1 text-[13px] text-slate-500">
        Finish drafts and resubmit anything that was sent back — counts match your list on Progress.
      </p>
      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
        <li>
          <Link
            href={`/progress?status=${PROGRESS_ASSESSMENT_STATUS.DRAFT}`}
            className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition hover:bg-slate-50/90"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-900">Drafts to submit</p>
              <p className="text-[11px] text-slate-500">Still in progress — submit when ready</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 tabular-nums">
              <span className="font-semibold text-slate-900">{draft.toLocaleString("en-IN")}</span>
              <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
            </span>
          </Link>
        </li>
        <li>
          <Link
            href={`/progress?status=${PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION}`}
            className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition hover:bg-slate-50/90"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-900">Sent back for updates</p>
              <p className="text-[11px] text-slate-500">Revise and resubmit for your head coach</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 tabular-nums">
              <span className="font-semibold text-slate-900">{n.toLocaleString("en-IN")}</span>
              <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
