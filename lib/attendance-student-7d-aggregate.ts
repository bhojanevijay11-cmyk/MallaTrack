import { normalizeStoredAttendanceStatus } from "@/lib/attendance-status";

/**
 * Rolling India-calendar 7-day attendance rollup for a single student.
 * Uses {@link normalizeStoredAttendanceStatus}: only PRESENT / LATE / ABSENT count as sessions;
 * unknown or legacy values are omitted so totals match bucket sums.
 */
export type AttendanceRollup7d = {
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendedCount: number;
};

export function aggregateAttendanceRows7d(
  rows: ReadonlyArray<{ status: string }>,
): AttendanceRollup7d | null {
  if (rows.length === 0) return null;
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  for (const r of rows) {
    const normalized = normalizeStoredAttendanceStatus(r.status);
    // Unrecognized values are excluded from totals so buckets always sum to totalSessions.
    if (normalized === null) continue;
    if (normalized === "PRESENT") presentCount += 1;
    else if (normalized === "LATE") lateCount += 1;
    else absentCount += 1;
  }
  const totalSessions = presentCount + lateCount + absentCount;
  if (totalSessions === 0) return null;
  const attendedCount = presentCount + lateCount;
  return {
    totalSessions,
    presentCount,
    lateCount,
    absentCount,
    attendedCount,
  };
}

export function attendanceAttendedRatePercent(
  rollup: AttendanceRollup7d | null,
): number | null {
  if (!rollup || rollup.totalSessions <= 0) return null;
  return Math.round((rollup.attendedCount / rollup.totalSessions) * 1000) / 10;
}
