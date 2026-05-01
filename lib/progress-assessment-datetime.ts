import { parseCalendarDateYmd } from "@/lib/datetime-india";

/**
 * Store a calendar YYYY-MM-DD as UTC noon on that civil date (Y/M/D components).
 * Matches "pure calendar date" semantics used by `parseCalendarDateYmd` / attendance-style keys.
 */
export function assessmentDateUtcNoonFromYmd(ymd: string): Date | null {
  const s = parseCalendarDateYmd(ymd);
  if (!s) return null;
  const [ys, ms, ds] = s.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
}

/** Inclusive calendar-day range filter on `assessmentDate` (DateTime column). */
export function assessmentDateGteFromYmd(ymd: string): Date | null {
  const s = parseCalendarDateYmd(ymd);
  if (!s) return null;
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

/** Exclusive upper bound: first instant after the calendar `to` day. */
export function assessmentDateLtExclusiveAfterYmd(ymd: string): Date | null {
  const s = parseCalendarDateYmd(ymd);
  if (!s) return null;
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0, 0));
}

/**
 * Accept API input: strict YYYY-MM-DD, or ISO-8601 date/datetime string.
 * Normalizes to the same UTC-noon `Date` used on create/update.
 */
export function parseAssessmentDateInput(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const ymd = parseCalendarDateYmd(t);
  if (ymd) return assessmentDateUtcNoonFromYmd(ymd);
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, mo - 1, day, 12, 0, 0, 0));
}
