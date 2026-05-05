import Link from "next/link";
import { AttendanceTrendCard } from "./AttendanceTrendCard";
import { DashboardHeader } from "./DashboardHeader";
import { KpiRow } from "./KpiRow";
import type { AttendanceTrendPoint, DashboardKpis } from "./mockData";
import { QUICK_ACTIONS } from "./mockData";
import type { ProgressAlertCounts } from "@/lib/progress-alerts";
import type { ProgressV2ReportingSnapshot } from "@/lib/progress-v2-reporting-queries";
import { ProgressAttentionPanels } from "@/components/operations/ProgressAttentionPanels";

type Props = {
  dateLabel: string;
  kpis: DashboardKpis;
  instituteLabel?: string | null;
  coachProgressAlerts?: ProgressAlertCounts | null;
  /** When loaded, review-queue numbers match assessment rows on `/progress/review`. */
  progressV2Snapshot?: ProgressV2ReportingSnapshot | null;
  attendanceTrendSeries: AttendanceTrendPoint[];
  attendanceTrendLoadFailed?: boolean;
  progressAlertsLoadFailed?: boolean;
};

export function AdminDashboard({
  dateLabel,
  kpis,
  instituteLabel,
  coachProgressAlerts = null,
  progressV2Snapshot = null,
  attendanceTrendSeries,
  attendanceTrendLoadFailed = false,
  progressAlertsLoadFailed = false,
}: Props) {
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-muted/80 to-white pb-16 md:pb-8">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <div className="space-y-3">
          <DashboardHeader
            dateLabel={dateLabel}
            quickActions={QUICK_ACTIONS}
            instituteLabel={instituteLabel}
          />

          <div className="grid gap-3 lg:grid-cols-12 lg:items-start lg:gap-3">
            <div className="order-2 space-y-3 lg:order-1 lg:col-span-8">
              <KpiRow kpis={kpis} />
              <AttendanceTrendCard
                series={attendanceTrendSeries}
                loadFailed={attendanceTrendLoadFailed}
              />
            </div>

            <div className="order-1 space-y-3 lg:order-2 lg:col-span-4">
              {progressAlertsLoadFailed ? (
                <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                  Progress summaries could not be loaded. Refresh the page or try again shortly.
                </p>
              ) : null}
              <nav
                className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm"
                aria-label="Management"
              >
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Management
                </h2>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-amber-900">
                  <li>
                    <Link className="underline-offset-2 hover:underline" href="/branches">
                      Branches
                    </Link>
                  </li>
                </ul>
              </nav>
              {coachProgressAlerts ? (
                <ProgressAttentionPanels
                  counts={coachProgressAlerts}
                  reviewQueueAssessmentCounts={
                    progressV2Snapshot
                      ? {
                          pendingReview: progressV2Snapshot.pendingReviewCount,
                          needsRevision: progressV2Snapshot.needsRevisionAssessmentCount,
                        }
                      : null
                  }
                  twoColumnOnLarge
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
