import { ProgressV2ReportingSection } from "@/components/operations/ProgressV2ReportingSection";
import { ReportsDatePicker } from "@/components/operations/ReportsDatePicker";
import { formatCalendarYmdAsDdMmYyyy } from "@/lib/datetime-india";
import type { ProgressV2ReportingSnapshot } from "@/lib/progress-v2-reporting-queries";
import type { BatchReportRow, ReportsSnapshot } from "@/lib/reports-queries";

function StaffAssignmentCell({ row }: { row: BatchReportRow }) {
  const parts: string[] = [];
  if (row.branchHeadCoachSummary?.trim()) {
    parts.push(`Head coach: ${row.branchHeadCoachSummary.trim()}`);
  }
  if (row.assistantCoachSummary?.trim()) {
    parts.push(`Assistants: ${row.assistantCoachSummary.trim()}`);
  }
  if (row.legacyCoachDirectoryName?.trim()) {
    parts.push(`Coach directory: ${row.legacyCoachDirectoryName.trim()}`);
  }
  if (parts.length === 0) {
    return <span className="text-amber-800/90">No staff assignments shown</span>;
  }
  return (
    <div className="max-w-[14rem] space-y-1 text-xs leading-snug sm:max-w-xs">
      {parts.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

const cardBase =
  "rounded-xl border border-slate-200/90 bg-white p-4 shadow-soft sm:p-5";

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={cardBase}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function BatchTable({ rows }: { rows: BatchReportRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">No batches yet.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <th className="px-3 py-2.5">Batch</th>
            <th className="px-3 py-2.5">Students</th>
            <th className="px-3 py-2.5">Assigned staff</th>
            <th className="px-3 py-2.5">Present</th>
            <th className="px-3 py-2.5">Absent</th>
            <th className="px-3 py-2.5">Unmarked</th>
            <th className="px-3 py-2.5">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.batchId} className="border-b border-slate-100">
              <td className="px-3 py-3 font-medium text-slate-900">
                {(r.batchName ?? "Unnamed").trim() || "Unnamed"}
                {(r.batchStatus ?? "").toUpperCase() !== "ACTIVE" ? (
                  <span className="ml-2 text-[10px] font-semibold uppercase text-slate-400">
                    {r.batchStatus}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-3 tabular-nums text-slate-600">{r.studentCount}</td>
              <td className="px-3 py-3 text-slate-700">
                <StaffAssignmentCell row={r} />
              </td>
              <td className="px-3 py-3 tabular-nums text-slate-600">{r.presentCount}</td>
              <td className="px-3 py-3 tabular-nums text-slate-600">{r.absentCount}</td>
              <td className="px-3 py-3 tabular-nums text-slate-600">{r.unmarkedCount}</td>
              <td className="px-3 py-3 tabular-nums font-medium text-slate-900">
                {r.studentCount === 0
                  ? "—"
                  : r.attendanceRatePct === null
                    ? "—"
                    : `${r.attendanceRatePct}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsDashboard({
  dateYmd,
  snapshot,
  progressV2,
}: {
  dateYmd: string;
  snapshot: ReportsSnapshot;
  progressV2?: ProgressV2ReportingSnapshot | null;
}) {
  const ddMmYyyy = formatCalendarYmdAsDdMmYyyy(dateYmd);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Report date
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{ddMmYyyy}</p>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Attendance rate uses present ÷ students in batch. Unmarked students lower the rate.
          </p>
        </div>
        <ReportsDatePicker valueYmd={dateYmd} />
      </div>

      {progressV2 ? (
        <ProgressV2ReportingSection data={progressV2} variant="reports" />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Active students"
          value={snapshot.totalStudents.toLocaleString("en-IN")}
          hint="Status ACTIVE"
        />
        <KpiCard
          label="Active batches"
          value={snapshot.totalActiveBatches.toLocaleString("en-IN")}
        />
        <KpiCard
          label="Active coaches"
          value={snapshot.totalActiveCoaches.toLocaleString("en-IN")}
        />
      </div>

      <div className={cardBase}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Batch overview
        </p>
        <div className="mt-4">
          <BatchTable rows={snapshot.batchRows} />
        </div>
      </div>

      <div className={cardBase}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Recent attendance (7 days)
        </p>
        <p className="mt-2 text-[13px] text-slate-500">
          Present count vs active students roster (all batches), per calendar day.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Present</th>
                <th className="px-3 py-2.5">Roster</th>
                <th className="px-3 py-2.5">Rate</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recentAttendanceByDay.map((d) => (
                <tr key={d.date} className="border-b border-slate-100">
                  <td className="px-3 py-2.5 font-medium text-slate-800">
                    {formatCalendarYmdAsDdMmYyyy(d.date)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{d.presentCount}</td>
                  <td className="px-3 py-2.5 tabular-nums">{d.denominator}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {d.pct === null ? "—" : `${d.pct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
