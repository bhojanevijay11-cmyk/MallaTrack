import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import {
  getAttendanceTrendLast7DaysForUser,
  getTodayAttendanceRatePercentScoped,
} from "@/lib/attendance-queries";
import { getActiveCoachesCount } from "@/lib/coaches-queries";
import { applyBatchesToKpis } from "@/lib/dashboard/batch-dashboard";
import { buildDashboardKpisFromStudents } from "@/lib/dashboard/student-dashboard";
import { getIndiaTodayCalendarYmd } from "@/lib/datetime-india";
import { getBatchesOrderedByCreatedDesc } from "@/lib/batches-queries";
import { getStudentsOrderedByCreatedDesc } from "@/lib/students-queries";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getProgressAlertCountsForUser } from "@/lib/progress-alerts-queries";
import { emptyProgressAlertCounts } from "@/lib/progress-alerts";
import { getProgressV2ReportingSnapshot } from "@/lib/progress-v2-reporting-queries";
import { ROLE_ADMIN } from "@/lib/roles";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const instituteId = session?.user?.instituteId ?? null;
  const instituteLabel = session?.user?.instituteName?.trim() || null;
  const displayName =
    session?.user?.name?.split("@")[0]?.trim() ||
    session?.user?.email?.split("@")[0]?.trim() ||
    null;

  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  let students: Awaited<ReturnType<typeof getStudentsOrderedByCreatedDesc>> = [];
  let batches: Awaited<ReturnType<typeof getBatchesOrderedByCreatedDesc>> = [];

  if (instituteId) {
    try {
      students = await getStudentsOrderedByCreatedDesc(instituteId);
    } catch {
      students = [];
    }
    try {
      batches = await getBatchesOrderedByCreatedDesc({ kind: "institute", instituteId });
    } catch {
      batches = [];
    }
  }

  const baseKpis = applyBatchesToKpis(
    buildDashboardKpisFromStudents(students),
    batches,
  );

  let todayAttendancePct: number | null = null;
  let activeCoachesCount: number | null = null;
  const adminAttendanceCtx: SessionUserWithInstitute | null =
    instituteId &&
    session?.user?.id &&
    session.user.role === ROLE_ADMIN
      ? {
          id: session.user.id,
          role: ROLE_ADMIN,
          branchId: session.user.branchId ?? null,
          instituteId,
        }
      : null;

  if (adminAttendanceCtx) {
    try {
      const ymd = getIndiaTodayCalendarYmd(now);
      todayAttendancePct = await getTodayAttendanceRatePercentScoped(adminAttendanceCtx, ymd);
    } catch {
      todayAttendancePct = null;
    }
  }
  if (instituteId) {
    try {
      activeCoachesCount = await getActiveCoachesCount(instituteId);
    } catch {
      activeCoachesCount = null;
    }
  }

  const kpis = {
    ...baseKpis,
    todayAttendancePct,
    todayAttendanceHint:
      instituteId === null
        ? "Link your account to an institute to load attendance KPIs."
        : todayAttendancePct === null
          ? "Mark attendance for today (India date)"
          : "India calendar day · roster in batches",
    activeCoaches: activeCoachesCount,
    activeCoachesHint:
      instituteId === null
        ? "Link your account to an institute to load coach counts."
        : activeCoachesCount === null
          ? "Could not load coaches"
          : activeCoachesCount === 0
            ? "Add roster coaches under Batch Head Coach assignment"
            : "Active coach records",
  };

  let coachProgressAlerts = null;
  let progressAlertsLoadFailed = false;
  const adminUserId = session?.user?.id?.trim() ?? "";
  let progressV2Snapshot = null;
  if (session?.user?.role === ROLE_ADMIN && instituteId && adminUserId) {
    try {
      coachProgressAlerts = await getProgressAlertCountsForUser({
        id: adminUserId,
        role: ROLE_ADMIN,
        branchId: session.user.branchId ?? null,
        instituteId,
      });
    } catch {
      coachProgressAlerts = emptyProgressAlertCounts();
      progressAlertsLoadFailed = true;
    }
    try {
      progressV2Snapshot = await getProgressV2ReportingSnapshot({
        id: adminUserId,
        role: ROLE_ADMIN,
        branchId: session.user.branchId ?? null,
        instituteId,
      });
    } catch {
      progressV2Snapshot = null;
    }
  }

  let attendanceTrendSeries: Awaited<
    ReturnType<typeof getAttendanceTrendLast7DaysForUser>
  >["series"] = [];
  let attendanceTrendLoadFailed = false;
  if (adminAttendanceCtx) {
    const trend = await getAttendanceTrendLast7DaysForUser(adminAttendanceCtx, now);
    attendanceTrendSeries = trend.series;
    attendanceTrendLoadFailed = trend.loadFailed;
  }

  return (
    <main>
      <AdminDashboard
        dateLabel={dateLabel}
        kpis={kpis}
        instituteLabel={instituteLabel}
        displayName={displayName}
        coachProgressAlerts={coachProgressAlerts}
        progressV2Snapshot={progressV2Snapshot}
        attendanceTrendSeries={attendanceTrendSeries}
        attendanceTrendLoadFailed={attendanceTrendLoadFailed}
        progressAlertsLoadFailed={progressAlertsLoadFailed}
      />
    </main>
  );
}
