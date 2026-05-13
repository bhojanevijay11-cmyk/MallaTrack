/**
 * Dashboard data shapes and safe defaults until API / Prisma wiring exists.
 */

export type AttendanceTrendPoint = {
  label: string;
  valuePct: number;
};

export type DashboardKpis = {
  totalActiveStudents: number | null;
  totalActiveStudentsHint: string;
  todayAttendancePct: number | null;
  todayAttendanceHint: string;
  activeBatchesToday: number | null;
  activeBatchesHint: string;
  activeCoaches: number | null;
  activeCoachesHint: string;
};

/** Safe defaults: no metrics until real data is loaded. */
export const EMPTY_KPIS: DashboardKpis = {
  totalActiveStudents: null,
  totalActiveStudentsHint: "No data yet",
  todayAttendancePct: null,
  todayAttendanceHint: "No data yet",
  activeBatchesToday: null,
  activeBatchesHint: "No data yet",
  activeCoaches: null,
  activeCoachesHint: "No data yet",
};

export const EMPTY_ATTENDANCE_TREND: AttendanceTrendPoint[] = [];
