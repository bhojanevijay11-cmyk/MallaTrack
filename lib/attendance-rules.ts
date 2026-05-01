import { getIndiaTodayCalendarYmd } from "@/lib/datetime-india";

const MS_PER_DAY = 86_400_000;

/** Calendar-day difference: `toYmd` minus `fromYmd` (both YYYY-MM-DD). */
export function calendarDaysBetweenYmd(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * Assistant Coach may edit attendance only when the session date is within the last N
 * calendar days including today (India wall date for `todayYmd`).
 */
export function isAssistantAttendanceEditAllowed(
  attendanceDateYmd: string,
  todayYmd: string,
  windowDays: number,
): boolean {
  const diff = calendarDaysBetweenYmd(attendanceDateYmd, todayYmd);
  return diff >= 0 && diff <= windowDays;
}

export const ASSISTANT_ATTENDANCE_EDIT_WINDOW_DAYS = 7;

export function assistantAttendanceEditDeniedReason(
  attendanceDateYmd: string,
  todayYmd: string = getIndiaTodayCalendarYmd(),
): string | null {
  if (
    isAssistantAttendanceEditAllowed(
      attendanceDateYmd,
      todayYmd,
      ASSISTANT_ATTENDANCE_EDIT_WINDOW_DAYS,
    )
  ) {
    return null;
  }
  return `Attendance can only be edited for dates within the last ${ASSISTANT_ATTENDANCE_EDIT_WINDOW_DAYS} days (India calendar).`;
}
