"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Calendar,
  ClipboardCheck,
  LogOut,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { ParentStudentDashboardBundle } from "@/lib/parent-dashboard-queries";
import { BrandMark } from "@/components/BrandMark";
import { ParentLatestProgressReportSection } from "@/components/parent/ParentLatestProgressReportSection";

function progressFootnote(score: number | null): string | null {
  if (score == null) return null;
  if (score >= 8) return "Strong overall rating";
  if (score >= 6) return "Solid progress";
  if (score >= 4) return "Room to grow";
  return "Coach will share more detail in feedback";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1)).toUpperCase();
}

function StatusDot({ status }: { status: string }) {
  const active = status.trim().toUpperCase() === "ACTIVE";
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white ${
        active ? "bg-emerald-500" : "bg-slate-300"
      }`}
    />
  );
}

function StudentPanel({ b }: { b: ParentStudentDashboardBundle }) {
  const batchCoachLine = [b.batchName, b.coachName ? `Coach ${b.coachName}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-3 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-4">
      <div className="flex flex-col gap-3">
        <section className="flex flex-col items-center border-b border-slate-100/90 pb-3 text-center">
          <div className="relative mb-2">
            <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-lg font-semibold text-slate-700 shadow-inner ring-2 ring-white">
              {initials(b.fullName)}
            </div>
            <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm">
              <StatusDot status={b.status} />
            </div>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            {b.fullName}
          </h2>
          {batchCoachLine ? (
            <p className="mt-0.5 max-w-sm text-xs font-normal leading-snug text-slate-500">
              {batchCoachLine}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-400">Not assigned to a batch yet</p>
          )}
          {b.branchLocationName?.trim() ? (
            <p className="mt-1 max-w-sm text-xs font-medium leading-snug text-slate-600">
              <span className="font-semibold text-slate-500">Location:</span>{" "}
              {b.branchLocationName.trim()}
            </p>
          ) : null}
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {b.status.trim().toUpperCase() === "ACTIVE" ? "Active" : b.status}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mb-1.5 flex items-center gap-1.5 text-slate-400">
              <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Attendance
              </span>
            </div>
            {b.attendanceSummary != null && b.attendanceSummary.totalSessions > 0 ? (
              <>
                <p className="text-sm font-semibold leading-snug text-slate-900">
                  Last 7 days: {b.attendanceSummary.attendedCount}/{b.attendanceSummary.totalSessions}{" "}
                  sessions attended
                </p>
                <p className="mt-1 text-[11px] leading-snug text-slate-600">
                  Present: {b.attendanceSummary.presentCount} | Late: {b.attendanceSummary.lateCount} | Absent:{" "}
                  {b.attendanceSummary.absentCount}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold tabular-nums text-slate-300">—</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  No sessions recorded yet — check back after attendance is marked.
                </p>
              </>
            )}
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mb-1.5 flex items-center gap-1.5 text-slate-400">
              <TrendingUp className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Progress
              </span>
            </div>
            {b.progressOverallScore == null ? (
              <>
                <p className="text-xl font-bold tabular-nums text-slate-300">—</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  Ask your coach when the next assessment is published.
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold tabular-nums text-slate-900">
                  {b.progressOverallScore}
                  <span className="text-base font-semibold text-slate-400">/10</span>
                </p>
                <p className="mt-0.5 text-[11px] font-normal leading-snug text-sky-800/90">
                  {progressFootnote(b.progressOverallScore) ?? "Overall score"}
                </p>
              </>
            )}
          </div>
        </section>

        <ParentLatestProgressReportSection report={b.latestProgressReport} variant="compact" />

        <section>
          <div className="relative overflow-hidden rounded-xl border border-amber-900/10 bg-gradient-to-br from-amber-900/95 via-orange-800/95 to-amber-950 p-3.5 text-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-100/85">
                  Development snapshot
                </p>
                {b.highlight.hasInsights ? (
                  <>
                    <p className="text-2xl font-bold tabular-nums tracking-tight sm:text-[1.65rem]">
                      {b.highlight.headline}
                    </p>
                    {b.highlight.subline ? (
                      <p className="text-xs font-normal leading-snug text-amber-50/95">
                        {b.highlight.subline}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-base font-semibold leading-snug text-amber-50">
                      {b.highlight.headline}
                    </p>
                    {b.highlight.subline ? (
                      <p className="text-xs font-normal leading-snug text-amber-100/88">
                        {b.highlight.subline}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              <Trophy
                className={`h-7 w-7 shrink-0 stroke-[1.5] sm:h-8 sm:w-8 ${
                  b.highlight.hasInsights ? "text-amber-200/75" : "text-amber-200/35"
                }`}
                aria-hidden
              />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-100/90 pt-2">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Coach feedback
          </p>
          {b.coachReview ? (
            <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{b.coachReview.authorLabel}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {b.coachReview.dateLabel}
                </p>
              </div>
              {b.coachReview.title ? (
                <p className="mb-1.5 text-sm font-medium text-slate-800">{b.coachReview.title}</p>
              ) : null}
              <p className="text-sm italic leading-relaxed text-slate-600">
                &ldquo;{b.coachReview.text}&rdquo;
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200/90 bg-white/60 px-3 py-4 text-center">
              <p className="text-xs leading-relaxed text-slate-500">
                No coach feedback published for parents yet. When your coach shares a note for
                families, it will appear here.
              </p>
            </div>
          )}
        </section>

        <section>
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 sm:px-3.5 ${
              b.sessionFallback
                ? "border-dashed border-slate-200/90 bg-white/80"
                : "border-slate-800/80 bg-slate-900 text-white shadow-[0_1px_3px_rgba(15,23,42,0.15)]"
            }`}
          >
            <div className="min-w-0">
              <p
                className={`text-[9px] font-bold uppercase tracking-[0.16em] ${
                  b.sessionFallback ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Batch schedule
              </p>
              <p
                className={`mt-0.5 text-xs font-semibold leading-snug ${
                  b.sessionFallback ? "text-slate-600" : "text-white"
                }`}
              >
                {b.sessionSummary ??
                  "Session times aren’t on file — contact your academy to confirm weekly times."}
              </p>
            </div>
            <Calendar
              className={`h-7 w-7 shrink-0 sm:h-8 sm:w-8 ${
                b.sessionFallback ? "text-slate-300" : "text-white/85"
              }`}
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
        </section>
      </div>
    </div>
  );
}

type ParentDashboardProps = {
  bundles: ParentStudentDashboardBundle[];
  instituteName: string | null;
  /** Greeting name (first segment of display name or email). */
  parentDisplayName?: string | null;
};

export function ParentDashboard({
  bundles,
  instituteName,
  parentDisplayName = null,
}: ParentDashboardProps) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (bundles.length === 0) return;
    setIdx((i) => Math.min(i, bundles.length - 1));
  }, [bundles.length]);

  const b = bundles[idx];
  if (!b) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-8 pt-5 sm:max-w-2xl sm:px-6">
        <p className="text-sm text-slate-600">No student data to display. Try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-8 pt-5 sm:max-w-2xl sm:px-6 lg:max-w-3xl lg:px-8 xl:max-w-[42rem]">
      <header className="mb-4 lg:mb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
            <p className="text-base font-bold tracking-tight text-slate-900">MallaTrack</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <LogOut className="h-3.5 w-3.5 opacity-80" aria-hidden />
            Logout
          </button>
        </div>
        {instituteName?.trim() ? (
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Institute · {instituteName.trim()}
          </p>
        ) : null}
      </header>

      <div className="mb-3 lg:mb-4">
        <h1 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Parent home</h1>
        {parentDisplayName?.trim() ? (
          <p className="mt-1 text-sm font-semibold text-slate-800">Hi {parentDisplayName.trim()}</p>
        ) : null}
        <p className="mt-1 max-w-md text-[13px] leading-snug text-slate-600">
          Published progress, attendance, and schedule for your child — select a student below if you have more than
          one.
        </p>
      </div>

      {bundles.length > 1 ? (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mb-4">
          {bundles.map((bundle, i) => (
            <button
              key={bundle.studentId}
              type="button"
              onClick={() => setIdx(i)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                i === idx
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/90 hover:bg-slate-50"
              }`}
            >
              {bundle.tabLabel}
            </button>
          ))}
        </div>
      ) : null}

      <StudentPanel key={b.studentId} b={b} />
    </div>
  );
}
