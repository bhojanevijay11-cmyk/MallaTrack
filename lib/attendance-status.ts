/**
 * Stored in `Attendance.status` (uppercase). Used by API + attendance UI.
 */
export const ATTENDANCE_MARK_STATUSES = ["PRESENT", "ABSENT", "LATE"] as const;
export type AttendanceMarkStatus = (typeof ATTENDANCE_MARK_STATUSES)[number];

/**
 * Statuses counted together as "attended" for attendance-rate KPIs only.
 * Do not use this for strict "present" semantics — use `isStrictPresentStatus`.
 */
export const ATTENDANCE_STATUSES_COUNTED_AS_ATTENDED_FOR_RATE: readonly AttendanceMarkStatus[] =
  ["PRESENT", "LATE"];

export function parseAttendanceMarkStatus(value: unknown): AttendanceMarkStatus | null {
  if (typeof value !== "string") return null;
  const u = value.trim().toUpperCase();
  if (u === "PRESENT" || u === "ABSENT" || u === "LATE") return u;
  return null;
}

export function isStrictPresentStatus(
  status: AttendanceMarkStatus | null | undefined,
): boolean {
  return status === "PRESENT";
}

export function isLateStatus(status: AttendanceMarkStatus | null | undefined): boolean {
  return status === "LATE";
}

export function isAbsentStatus(status: AttendanceMarkStatus | null | undefined): boolean {
  return status === "ABSENT";
}

/** True for PRESENT or LATE — for rate math / "attended" counts only. */
export function isAttendancePresentLike(
  status: AttendanceMarkStatus | null | undefined,
): boolean {
  return status === "PRESENT" || status === "LATE";
}

export function isMarkedAttendanceStatus(
  status: AttendanceMarkStatus | null | undefined,
): boolean {
  return (
    status === "PRESENT" || status === "ABSENT" || status === "LATE"
  );
}

/** Normalize DB string to mark status, or null if missing/legacy. */
export function normalizeStoredAttendanceStatus(
  raw: string | null | undefined,
): AttendanceMarkStatus | null {
  return parseAttendanceMarkStatus(raw ?? "");
}
