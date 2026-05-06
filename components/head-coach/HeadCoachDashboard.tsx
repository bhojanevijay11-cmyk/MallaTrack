"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { ProgressAttentionPanels } from "@/components/operations/ProgressAttentionPanels";
import { ProgressV2ReportingSection } from "@/components/operations/ProgressV2ReportingSection";
import type { HeadCoachDashboardSnapshot } from "@/lib/head-coach-branch-data";
import { READINESS_LEVEL } from "@/lib/progress-readiness";

type HeadCoachDashboardProps = {
  initialSnapshot: HeadCoachDashboardSnapshot | null;
  displayName: string;
  instituteName?: string | null;
};

export function HeadCoachDashboard({
  initialSnapshot,
  displayName,
  instituteName,
}: HeadCoachDashboardProps) {
  const snap = initialSnapshot;

  const branchLabel = snap?.branchName?.trim() || null;
  const summary = snap?.summary;
  const assistantScopePhrase = branchLabel ? "in this location" : "across your batches";

  const supportLine = (
    <>
      Welcome back, {displayName}.
      {!branchLabel ? (
        <>
          {" "}
          <span className="font-semibold text-slate-800">All locations</span> in your institute
          {summary ? " · " : "."}
        </>
      ) : summary ? (
        " "
      ) : null}
      {summary ? (
        <>
          <span className="font-semibold text-slate-800">{summary.activeBatches}</span>{" "}
          active batch{summary.activeBatches === 1 ? "" : "es"},{" "}
          <span className="font-semibold text-slate-800">{summary.enrolledStudents}</span>{" "}
          enrolled student{summary.enrolledStudents === 1 ? "" : "s"}
          {summary.assistantCoachCount > 0 ? (
            <>
              ,{" "}
              <span className="font-semibold text-slate-800">
                {summary.assistantCoachCount}
              </span>{" "}
              assistant coach
              {summary.assistantCoachCount === 1 ? "" : "es"} {assistantScopePhrase}
            </>
          ) : null}
          .
        </>
      ) : null}
    </>
  );

  const att = snap?.todayAttendance;
  const attendanceEmpty =
    snap && att && att.expectedCount === 0 && !att.hasSubmission;
  const attendanceNoSubmit =
    snap && att && att.expectedCount > 0 && !att.hasSubmission;

  return (
    <main className="mx-auto max-w-7xl px-4 py-2 sm:px-6 sm:py-3 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-900/90">
              Head coach
            </p>
            {instituteName?.trim() ? (
              <p className="mt-0.5 text-xs font-medium text-slate-600">
                Institute · <span className="text-slate-800">{instituteName.trim()}</span>
                {branchLabel ? (
                  <>
                    {" "}
                    · Location · <span className="text-slate-800">{branchLabel}</span>
                  </>
                ) : null}
              </p>
            ) : branchLabel ? (
              <p className="mt-0.5 text-xs font-medium text-slate-600">
                Location · <span className="text-slate-800">{branchLabel}</span>
              </p>
            ) : null}
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl md:text-2xl">
              Overview
            </h1>
            <p className="mt-0.5 max-w-2xl text-[13px] leading-snug text-slate-600 sm:text-sm">
              Review submitted progress assessments, approve or send back updates, and keep attendance and batches on
              track
              {branchLabel ? " for this location" : ""}.
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-snug text-slate-600">{supportLine}</p>
          </div>
          <div
            className="flex w-full shrink-0 flex-col gap-1.5 sm:w-auto sm:min-w-[220px]"
            aria-label="Quick actions"
          >
            {snap ? (
              <>
                <Link
                  href="/progress/review?status=PENDING_REVIEW"
                  className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-950/20 transition hover:brightness-105"
                >
                  Pending review queue
                  <span className="tabular-nums opacity-90">
                    ({snap.progressV2.pendingReviewCount})
                  </span>
                </Link>
                <Link
                  href={`/students?readiness=${READINESS_LEVEL.NEEDS_WORK}`}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Students needing work
                  <span className="tabular-nums text-slate-500">({snap.progressAlerts.needsWork})</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                </Link>
                <Link
                  href="/students?alert=LOW_ATTENDANCE"
                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700" aria-hidden />
                  Attendance issues
                  <span className="tabular-nums text-slate-500">
                    ({snap.lowAttendanceAttentionCount})
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                </Link>
                {snap.progressV2.needsRevisionAssessmentCount > 0 ? (
                  <Link
                    href="/progress/review?status=NEEDS_REVISION"
                    className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs font-semibold text-amber-950 transition hover:bg-amber-50"
                  >
                    Needs revision
                    <span className="tabular-nums text-amber-900/80">
                      ({snap.progressV2.needsRevisionAssessmentCount})
                    </span>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ) : null}
              </>
            ) : (
              <Link
                href="/progress/review?status=PENDING_REVIEW"
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-950/20 transition hover:brightness-105"
              >
                Pending review queue
                <ChevronRight className="h-4 w-4 opacity-90" aria-hidden />
              </Link>
            )}
          </div>
        </div>

        <section
          className="mt-2 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm sm:mt-3"
          aria-label="Today operational snapshot"
        >
          <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 sm:px-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              Today
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Attendance and students needing attention</p>
          </div>
          <div className="grid md:grid-cols-2 md:divide-x md:divide-slate-100">
            <Link
              href="/attendance"
              className="group block p-3 transition hover:bg-slate-50/80"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Attendance
                  </h3>
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-slate-500"
                  aria-hidden
                />
              </div>
              {!snap ? (
                <div className="mt-2">
                  <p className="text-sm font-medium text-slate-800">No data yet.</p>
                </div>
              ) : attendanceEmpty ? (
                <div className="mt-2">
                  <p className="text-sm font-medium text-slate-800">No enrolled students yet.</p>
                </div>
              ) : attendanceNoSubmit ? (
                <div className="mt-2">
                  <p className="text-sm font-medium text-slate-800">Not submitted for today yet.</p>
                </div>
              ) : att && att.hasSubmission ? (
                <>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                    {att.percent != null ? `${att.percent}%` : "—"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {att.presentCount} of {att.expectedCount} students present today
                  </p>
                </>
              ) : (
                <div className="mt-2">
                  <p className="text-sm font-medium text-slate-800">No attendance data for today yet.</p>
                </div>
              )}
            </Link>

            <div className="border-t border-slate-100 p-3 md:border-t-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Students needing attention
                </h3>
                <Link
                  href="/students?filter=needs-attention"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline"
                >
                  View all
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              {!snap || snap.attentionStudents.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">None right now.</p>
              ) : (
                <ul className="mt-2 max-h-[min(160px,30vh)] space-y-1 overflow-y-auto overscroll-contain pr-0.5 md:max-h-[min(180px,32vh)]">
                  {snap.attentionStudents.map((s) => (
                    <li key={s.studentId}>
                      <Link
                        href={`/students/${s.studentId}`}
                        className="flex gap-2 rounded-lg border border-transparent px-1 py-1.5 transition hover:border-slate-100 hover:bg-slate-50"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-[11px] font-semibold text-slate-600">
                          {(s.studentName ?? "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight text-slate-900">
                            {s.studentName}
                          </p>
                          <p className="text-[11px] text-slate-500">{s.batchName?.trim() || "Batch"}</p>
                          <p className="text-[11px] font-medium text-amber-900/90">{s.reasonLabel}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 self-center text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {snap ? (
          <div className="mt-3 sm:mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Assessments to review &amp; student alerts
            </p>
            <ProgressAttentionPanels
              compact
              twoColumnOnLarge
              counts={snap.progressAlerts}
              reviewQueueAssessmentCounts={{
                pendingReview: snap.progressV2.pendingReviewCount,
                needsRevision: snap.progressV2.needsRevisionAssessmentCount,
              }}
            />
          </div>
        ) : null}

        {snap?.progressV2 ? (
          <div className="mt-3 sm:mt-4">
            <ProgressV2ReportingSection
              data={snap.progressV2}
              variant="headCoach"
              visualPriority="muted"
            />
          </div>
        ) : null}

        <section className="mt-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Batch summary
            </h2>
            {summary ? (
              <p className="text-xs font-medium text-slate-500">
                Enrollment <span className="text-slate-900">{summary.enrolledStudents}</span>
              </p>
            ) : null}
          </div>
          <ul className="mt-2 space-y-1.5">
            {!snap || snap.batches.length === 0 ? (
              <li className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-sm text-slate-600">
                No active batches.
              </li>
            ) : (
              snap.batches.map((b) => {
                const window =
                  b.startTime && b.endTime
                    ? `${b.startTime} – ${b.endTime}`
                    : "Schedule TBD";
                const marking =
                  b.todayMarking === "complete"
                    ? "Attendance complete"
                    : b.todayMarking === "partial"
                      ? "Attendance in progress"
                      : "Not marked today";
                const headLine = b.branchHeadCoachLabel?.trim() || null;
                const assistants = b.assistantCoachSummary?.trim() || null;
                const directory = b.coachName?.trim() || null;
                return (
                  <li key={b.id}>
                    <Link
                      href={`/batches/${b.id}`}
                      className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/40 px-2.5 py-2 transition hover:border-slate-200 hover:bg-white sm:gap-3 sm:px-3 sm:py-2.5"
                    >
                      <span
                        className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-amber-800/90 sm:h-9"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-slate-900">
                          {b.name ?? "Unnamed batch"}
                        </p>
                        <p className="text-[11px] text-slate-500">{window}</p>
                        <dl className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                          <div className="flex gap-1">
                            <dt className="shrink-0 font-medium text-slate-400">Head coach</dt>
                            <dd className="min-w-0">
                              {headLine ?? (
                                <span className="text-slate-500 italic">No head coach assigned</span>
                              )}
                            </dd>
                          </div>
                          <div className="flex gap-1">
                            <dt className="shrink-0 font-medium text-slate-400">Assistants</dt>
                            <dd className="min-w-0">
                              {assistants ?? (
                                <span className="text-slate-500 italic">No assistant coaches assigned</span>
                              )}
                            </dd>
                          </div>
                          {directory ? (
                            <div className="flex gap-1">
                              <dt className="shrink-0 font-medium text-slate-400">Directory</dt>
                              <dd className="min-w-0">{directory}</dd>
                            </div>
                          ) : null}
                          <div className="pt-0.5 text-slate-500">{marking}</div>
                        </dl>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs font-medium text-slate-700 sm:text-sm">
                          {b.studentCount}
                        </span>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          students
                        </p>
                        <ChevronRight className="ml-auto mt-0.5 h-4 w-4 text-slate-300" />
                      </div>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </section>
    </main>
  );
}
