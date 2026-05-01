import Link from "next/link";
import { formatCalendarYmdAsDdMmYyyy } from "@/lib/datetime-india";
import type { ProgressV2ReportingSnapshot } from "@/lib/progress-v2-reporting-queries";
import { READINESS_LEVEL } from "@/lib/progress-readiness";

const sectionShell =
  "rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm";
const sectionShellHeadCoach =
  "rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm";
const kpiTile =
  "rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-sm";
const kpiTileHeadCoach =
  "rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-sm";

const INDICATOR_LABELS: Record<string, string> = {
  ON_TRACK: "On track",
  NEEDS_ATTENTION: "Needs attention",
  EXCELLING: "Excelling",
};

function KpiCard({
  label,
  value,
  hint,
  dense,
}: {
  label: string;
  value: string;
  hint?: string;
  dense?: boolean;
}) {
  const tile = dense ? kpiTileHeadCoach : kpiTile;
  const valueCls = dense ? "mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900" : "mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900";
  return (
    <div className={tile}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={valueCls}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function indicatorLabel(code: string | null): string {
  if (!code) return "—";
  return INDICATOR_LABELS[code] ?? code;
}

export function ProgressV2ReportingSection({
  data,
  variant = "reports",
  /** Lower visual weight on dense dashboards (still fully usable). */
  visualPriority = "normal",
}: {
  data: ProgressV2ReportingSnapshot;
  /** Head coach dashboard uses a slightly denser heading; reports page uses wider layout. */
  variant?: "reports" | "headCoach";
  visualPriority?: "normal" | "muted";
}) {
  const headingCls =
    variant === "headCoach"
      ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
      : "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400";

  const dense = variant === "headCoach";
  const introText = dense ? "mt-1 text-xs leading-snug text-slate-500" : "mt-1 text-[13px] text-slate-500";
  const sectionClass =
    dense && visualPriority === "muted"
      ? "rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 p-3 shadow-none"
      : dense
        ? sectionShellHeadCoach
        : sectionShell;

  return (
    <section className={sectionClass} aria-label="Progress overview V2">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div>
          <h2 className={headingCls}>Progress overview (V2)</h2>
          <p className={introText}>
            Workflow counts and approved assessments only. Drafts and revisions are excluded from
            approval metrics.
          </p>
        </div>
        {variant === "headCoach" ? (
          <Link
            href="/progress/review?status=PENDING_REVIEW"
            className="text-xs font-semibold text-amber-900 hover:underline"
          >
            Review queue
          </Link>
        ) : null}
      </div>

      <div className={dense ? "mt-4 grid gap-2.5 sm:grid-cols-3" : "mt-5 grid gap-3 sm:grid-cols-3"}>
        <KpiCard
          dense={dense}
          label="Pending review"
          value={data.pendingReviewCount.toLocaleString("en-IN")}
          hint="Submitted, awaiting review"
        />
        <KpiCard
          dense={dense}
          label="Approved assessments"
          value={data.approvedCount.toLocaleString("en-IN")}
          hint="Official history count"
        />
        <KpiCard
          dense={dense}
          label="Avg approved overall"
          value={
            data.avgApprovedOverallScore != null
              ? `${data.avgApprovedOverallScore} / 10`
              : "—"
          }
          hint="Non-null scores only"
        />
      </div>

      <div className={dense ? "mt-4" : "mt-6"}>
        <h3 className={headingCls}>Readiness (latest approved per student)</h3>
        <p className={dense ? "mt-1 text-xs leading-snug text-slate-500" : "mt-1 text-[13px] text-slate-500"}>
          Derived from each student&apos;s most recent approved overall score. Students without an
          approved assessment count as Needs Work.
        </p>
        <ul className={dense ? "mt-2 grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-4" : "mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"}>
          <li>
            <Link
              href={`/students?readiness=${READINESS_LEVEL.NEEDS_WORK}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 transition hover:bg-red-50"
            >
              <span className="font-medium text-red-950">Needs Work</span>
              <span className="tabular-nums font-semibold text-red-900">
                {data.readinessByLevel.needsWork.toLocaleString("en-IN")}
              </span>
            </Link>
          </li>
          <li>
            <Link
              href={`/students?readiness=${READINESS_LEVEL.DEVELOPING}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 transition hover:bg-amber-50"
            >
              <span className="font-medium text-amber-950">Developing</span>
              <span className="tabular-nums font-semibold text-amber-900">
                {data.readinessByLevel.developing.toLocaleString("en-IN")}
              </span>
            </Link>
          </li>
          <li>
            <Link
              href={`/students?readiness=${READINESS_LEVEL.NEARLY_READY}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 transition hover:bg-blue-50"
            >
              <span className="font-medium text-blue-950">Nearly Ready</span>
              <span className="tabular-nums font-semibold text-blue-900">
                {data.readinessByLevel.nearlyReady.toLocaleString("en-IN")}
              </span>
            </Link>
          </li>
          <li>
            <Link
              href={`/students?readiness=${READINESS_LEVEL.COMPETITION_READY}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 transition hover:bg-emerald-50"
            >
              <span className="font-medium text-emerald-950">Competition Ready</span>
              <span className="tabular-nums font-semibold text-emerald-900">
                {data.readinessByLevel.competitionReady.toLocaleString("en-IN")}
              </span>
            </Link>
          </li>
        </ul>
      </div>

      <div className={dense ? "mt-4" : "mt-6"}>
        <h3 className={headingCls}>Recent approved</h3>
        {data.recentApproved.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No approved assessments in this scope yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-2.5">Student</th>
                  <th className="px-3 py-2.5">Batch</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Overall</th>
                  <th className="px-3 py-2.5">Indicator</th>
                </tr>
              </thead>
              <tbody>
                {data.recentApproved.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      <Link href={`/students/${r.studentId}`} className="hover:underline">
                        {r.studentName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {(r.batchName ?? "—").trim() || "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-700">
                      {formatCalendarYmdAsDdMmYyyy(r.assessmentDateYmd)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-800">
                      {r.overallScore ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{indicatorLabel(r.assessmentIndicator)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.batchBreakdown.length > 0 ? (
        <div className={dense ? "mt-4" : "mt-6"}>
          <h3 className={headingCls}>By batch (approved)</h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-2.5">Batch</th>
                  <th className="px-3 py-2.5">Approved</th>
                  <th className="px-3 py-2.5">Avg overall</th>
                </tr>
              </thead>
              <tbody>
                {data.batchBreakdown.map((b) => (
                  <tr key={b.batchId} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      <Link href={`/batches/${b.batchId}`} className="hover:underline">
                        {(b.batchName ?? "Unnamed").trim() || "Unnamed"}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600">{b.approvedCount}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-800">
                      {b.avgOverallScore != null ? `${b.avgOverallScore} / 10` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
