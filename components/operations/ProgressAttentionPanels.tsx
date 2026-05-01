"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PROGRESS_ALERT_TYPE, type ProgressAlertCounts } from "@/lib/progress-alerts";
import { READINESS_LEVEL } from "@/lib/progress-readiness";

type Row = { key: string; label: string; hint: string; count: number; href: string };

const listBase = "mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100";
const rowBase =
  "flex items-center justify-between gap-3 text-sm transition hover:bg-slate-50/90";

export function ProgressAttentionPanels({
  counts,
  /**
   * When set, review queue numbers match `/progress/review?status=` lists (assessment rows).
   * Otherwise falls back to distinct-student counts from {@link counts}.
   */
  reviewQueueAssessmentCounts = null,
  compact = false,
  /** Side-by-side review queue + alerts on large screens (saves vertical space). */
  twoColumnOnLarge = false,
}: {
  counts: ProgressAlertCounts;
  reviewQueueAssessmentCounts?: { pendingReview: number; needsRevision: number } | null;
  /** Tighter padding (e.g. head coach dashboard column). */
  compact?: boolean;
  twoColumnOnLarge?: boolean;
}) {
  const pendingReviewDisplay =
    reviewQueueAssessmentCounts?.pendingReview ?? counts.pendingReview;
  const needsRevisionDisplay =
    reviewQueueAssessmentCounts?.needsRevision ?? counts.needsRevision;

  const reviewQueue: Row[] = [
    {
      key: "pending",
      label: "Pending review",
      hint: "Submitted assessments awaiting review",
      count: pendingReviewDisplay,
      href: "/progress/review?status=PENDING_REVIEW",
    },
    {
      key: "revision",
      label: "Needs revision",
      hint: "Assessments returned for correction",
      count: needsRevisionDisplay,
      href: "/progress/review?status=NEEDS_REVISION",
    },
  ];

  const studentAlerts: Row[] = [
    {
      key: "coach-feedback",
      label: "Pending staff feedback",
      hint: "Parent-visible drafts not yet published",
      count: counts.pendingCoachFeedbackDrafts,
      href: "/students?alert=PENDING_COACH_FEEDBACK",
    },
    {
      key: "work",
      label: "Needs work",
      hint: "Students in the Needs Work readiness band (same as Progress overview)",
      count: counts.needsWork,
      href: `/students?readiness=${READINESS_LEVEL.NEEDS_WORK}`,
    },
    {
      key: "stale",
      label: "Stale progress",
      hint: "Approved assessment older than 30 days — follow up",
      count: counts.staleProgress,
      href: `/students?alert=${PROGRESS_ALERT_TYPE.STALE_PROGRESS}`,
    },
  ];

  const reviewSection = compact
    ? "rounded-xl border border-amber-200/60 bg-gradient-to-b from-amber-50/35 to-white p-3 shadow-sm"
    : "rounded-xl border border-amber-200/60 bg-gradient-to-b from-amber-50/35 to-white p-3 shadow-sm";
  const alertsSection = compact
    ? "rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm"
    : "rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm";
  const reviewDesc = compact ? "mt-1 text-[11px] leading-snug text-slate-600" : "mt-1 text-xs leading-snug text-slate-600";
  const alertsDesc = compact ? "mt-1 text-[11px] leading-snug text-slate-500" : "mt-1 text-xs leading-snug text-slate-500";
  const rowPad = compact ? "px-3 py-2" : "px-3 py-2.5";

  const layoutClass = twoColumnOnLarge
    ? "grid gap-3 lg:grid-cols-2 lg:items-start"
    : "space-y-3";

  return (
    <div className={layoutClass}>
      <section className={reviewSection}>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-950/80">
          Review queue
        </h2>
        <p className={reviewDesc}>
          Operational workflow — open the queue and move assessments forward.
        </p>
        <ul className={listBase}>
          {reviewQueue.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className={`${rowBase} ${rowPad}`}>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{r.label}</p>
                  <p className="text-[11px] leading-snug text-slate-500">{r.hint}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 tabular-nums">
                  <span className="font-semibold text-slate-900">{r.count.toLocaleString("en-IN")}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={alertsSection}>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Student alerts
        </h2>
        <p className={alertsDesc}>
          Monitoring and roster drilldowns — counts are distinct students per category.
        </p>
        <ul className={listBase}>
          {studentAlerts.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className={`${rowBase} ${rowPad}`}>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{r.label}</p>
                  <p className="text-[11px] leading-snug text-slate-500">{r.hint}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 tabular-nums">
                  <span className="font-semibold text-slate-900">{r.count.toLocaleString("en-IN")}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
