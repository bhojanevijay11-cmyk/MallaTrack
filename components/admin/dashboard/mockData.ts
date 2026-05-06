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

export type QuickActionDef = {
  id: string;
  label: string;
  description: string;
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

export const QUICK_ACTIONS: QuickActionDef[] = [
  {
    id: "progress-review",
    label: "Progress review",
    description: "Pending assessments",
  },
  {
    id: "students",
    label: "Students",
    description: "Roster & alerts",
  },
  {
    id: "branches",
    label: "Branches",
    description: "Locations & settings",
  },
  {
    id: "batches",
    label: "Batches",
    description: "Schedules & assignments",
  },
  {
    id: "coaches",
    label: "Coaches",
    description: "Staff roster",
  },
  {
    id: "attendance",
    label: "Attendance",
    description: "Mark & review today",
  },
];
