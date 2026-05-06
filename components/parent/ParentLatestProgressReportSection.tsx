import Link from "next/link";
import type { ParentLatestProgressReport } from "@/lib/parent-dashboard-queries";
import { PROGRESS_ASSESSMENT_INDICATOR } from "@/lib/progress-assessment-constants";

const EXERCISE_NOTE_COMPACT_MAX = 100;
const COACH_SUMMARY_COMPACT_MAX = 220;

function truncateEllipsis(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

function indicatorBadgeTone(
  key: string | null,
): { label: string; className: string } {
  if (key === PROGRESS_ASSESSMENT_INDICATOR.NEEDS_ATTENTION) {
    return {
      label: "Needs attention",
      className: "bg-amber-50 text-amber-950 ring-amber-200/90",
    };
  }
  if (key === PROGRESS_ASSESSMENT_INDICATOR.EXCELLING) {
    return {
      label: "Excelling",
      className: "bg-violet-50 text-violet-950 ring-violet-200/80",
    };
  }
  if (key === PROGRESS_ASSESSMENT_INDICATOR.ON_TRACK) {
    return {
      label: "On track",
      className: "bg-emerald-50 text-emerald-950 ring-emerald-200/90",
    };
  }
  return {
    label: "Overall",
    className: "bg-slate-50 text-slate-800 ring-slate-200/90",
  };
}

function dimensionSummary(r: ParentLatestProgressReport): string | null {
  const parts: string[] = [];
  if (r.strengthScore != null) parts.push(`Strength ${r.strengthScore}`);
  if (r.flexibilityScore != null) parts.push(`Flexibility ${r.flexibilityScore}`);
  if (r.techniqueScore != null) parts.push(`Technique ${r.techniqueScore}`);
  if (r.disciplineScore != null) parts.push(`Discipline ${r.disciplineScore}`);
  return parts.length ? parts.join(" · ") : null;
}

export function ParentLatestProgressReportSection({
  report,
  variant = "compact",
  showViewFullLink = true,
  showSectionHeading = true,
}: {
  report: ParentLatestProgressReport | null;
  variant?: "compact" | "full";
  showViewFullLink?: boolean;
  /** When false, omit the in-card title (e.g. full page already has a page title). */
  showSectionHeading?: boolean;
}) {
  const compact = variant === "compact";

  if (!report) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-200/90 bg-white/80 p-4 shadow-sm sm:p-5">
        {showSectionHeading ? (
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Latest published progress
          </h2>
        ) : null}
        <p className={`text-sm leading-relaxed text-slate-600 ${showSectionHeading ? "mt-3" : ""}`}>
          No published progress update yet. Your coach will share one here when it is ready for families.
        </p>
      </section>
    );
  }

  const badge = indicatorBadgeTone(report.indicatorKey);
  const dims = dimensionSummary(report);

  const coachBlock =
    report.coachSummary && report.coachSummary.trim().length > 0 ? (
      <p
        className={`text-sm leading-relaxed text-slate-700 ${
          compact ? "" : "whitespace-pre-wrap"
        }`}
        title={compact ? report.coachSummary : undefined}
      >
        {compact
          ? truncateEllipsis(report.coachSummary, COACH_SUMMARY_COMPACT_MAX)
          : report.coachSummary.trim()}
      </p>
    ) : (
      <p className="text-sm italic text-slate-500">No coach feedback shared yet.</p>
    );

  const exerciseNoteDisplay = (note: string | null) => {
    if (!note?.trim()) return "—";
    const t = note.trim();
    if (!compact || t.length <= EXERCISE_NOTE_COMPACT_MAX) return t;
    return truncateEllipsis(t, EXERCISE_NOTE_COMPACT_MAX);
  };

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-5">
      {showSectionHeading || (showViewFullLink && compact) ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          {showSectionHeading ? (
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Latest published progress
            </h2>
          ) : null}
          {showViewFullLink && compact ? (
            <Link
              href={`/parent/progress/${encodeURIComponent(report.assessmentId)}`}
              className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline sm:shrink-0"
            >
              View full report
            </Link>
          ) : null}
        </div>
      ) : null}

      <div
        className={`rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 sm:p-4 ${
          showSectionHeading || (showViewFullLink && compact) ? "mt-4" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 gap-y-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Score
            </span>
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {report.overallScore != null ? (
                <>
                  {report.overallScore}
                  <span className="text-lg font-semibold text-slate-400">/10</span>
                </>
              ) : (
                <span className="text-lg font-semibold text-slate-400">—</span>
              )}
            </span>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${badge.className}`}
          >
            {report.indicatorLabel ?? badge.label}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Last updated: {report.lastUpdatedLabel}
        </p>
        {dims ? (
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{dims}</p>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Practice breakdown
        </p>
        {report.exercises.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No exercises were listed for this report.
          </p>
        ) : (
          <>
            <div className="mt-2 hidden overflow-hidden rounded-xl border border-slate-200/90 md:block">
              <table className="w-full min-w-0 border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/90 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">Exercise</th>
                    <th className="px-3 py-2.5 font-semibold">Target</th>
                    <th className="px-3 py-2.5 font-semibold">Completed</th>
                    <th className="px-3 py-2.5 font-semibold">Coach note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.exercises.map((ex, i) => (
                    <tr key={`${ex.exerciseName}-${i}`} className="bg-white">
                      <td className="max-w-[10rem] px-3 py-2.5 font-medium text-slate-900">
                        <span className="line-clamp-2">{ex.exerciseName}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        <span className="line-clamp-2 break-words">{ex.targetLabel}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        <span className="line-clamp-2 break-words">{ex.completedLabel}</span>
                      </td>
                      <td className="max-w-[12rem] px-3 py-2.5 text-slate-600">
                        <span className="line-clamp-2 break-words text-xs">
                          {exerciseNoteDisplay(ex.coachNote)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-2 space-y-2 md:hidden">
              {report.exercises.map((ex, i) => (
                <li
                  key={`${ex.exerciseName}-m-${i}`}
                  className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <p className="font-semibold leading-snug text-slate-900">{ex.exerciseName}</p>
                  <div className="mt-2 grid gap-2 text-xs">
                    <div className="rounded-lg border border-sky-100/90 bg-sky-50/40 px-2.5 py-1.5">
                      <span className="font-semibold text-sky-900/90">Target: </span>
                      <span className="text-slate-800">{ex.targetLabel}</span>
                    </div>
                    <div className="rounded-lg border border-emerald-100/90 bg-emerald-50/40 px-2.5 py-1.5">
                      <span className="font-semibold text-emerald-900/90">Completed: </span>
                      <span className="text-slate-800">{ex.completedLabel}</span>
                    </div>
                    {ex.coachNote?.trim() ? (
                      <p className="text-slate-600">
                        <span className="font-semibold text-slate-700">Coach note: </span>
                        {exerciseNoteDisplay(ex.coachNote)}
                      </p>
                    ) : (
                      <p className="text-slate-400">Coach note: —</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Coach summary
        </p>
        <div className="mt-2">{coachBlock}</div>
      </div>
    </section>
  );
}
