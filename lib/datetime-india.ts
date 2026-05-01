/** India wall-clock for instants stored as UTC/ISO (e.g. Prisma DateTime, JSON strings). */
export const INDIA_TIMEZONE = "Asia/Kolkata";

function partsFromInstant(
  input: Date | string | number,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatPart[] {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return [];
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).formatToParts(d);
}

function partMap(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") m[p.type] = p.value;
  }
  return m;
}

/** DD/MM/YYYY in Asia/Kolkata (explicit; not browser-default locale). */
export function formatInstantAsDdMmYyyy(
  input: Date | string | number,
  timeZone: string = INDIA_TIMEZONE,
): string {
  const parts = partsFromInstant(input, timeZone, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const m = partMap(parts);
  const day = m.day;
  const month = m.month;
  const year = m.year;
  if (!day || !month || !year) return "—";
  return `${day}/${month}/${year}`;
}

/** Batch list/detail: created line with Indian calendar date. */
export function formatBatchCreatedLine(
  input: Date | string | number,
  timeZone: string = INDIA_TIMEZONE,
): string {
  const inner = formatInstantAsDdMmYyyy(input, timeZone);
  if (inner === "—") return "—";
  return `Created ${inner}`;
}

/**
 * Calendar-only day key for attendance / reports (YYYY-MM-DD).
 * Uses Asia/Kolkata wall date — not derived from UTC midnight shifts.
 */
export function getIndiaTodayCalendarYmd(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const m: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") m[p.type] = p.value;
  }
  const y = m.year;
  const mo = m.month;
  const d = m.day;
  if (!y || !mo || !d) return "";
  return `${y}-${mo}-${d}`;
}

/**
 * Add/subtract whole calendar days to a YYYY-MM-DD string (Gregorian wall date).
 * Used for India calendar-day keys (`getIndiaTodayCalendarYmd`) without timezone drift.
 */
export function shiftCalendarYmdByDays(ymd: string, deltaDays: number): string | null {
  const parsed = parseCalendarDateYmd(ymd);
  if (!parsed) return null;
  const [y, mo, d] = parsed.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Inclusive list of India calendar YYYY-MM-DD strings for the last `n` days ending on India "today"
 * (index 0 = today, index n-1 = n-1 days ago).
 */
export function getIndiaLastNCalendarDaysYmd(now: Date, n: number): string[] {
  const today = getIndiaTodayCalendarYmd(now);
  if (!today || n < 1) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const day = shiftCalendarYmdByDays(today, -i);
    if (day) out.push(day);
  }
  return out;
}

/** Validate YYYY-MM-DD and reject impossible calendar dates. */
export function parseCalendarDateYmd(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [ys, ms, ds] = s.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return s;
}

/** Display YYYY-MM-DD as DD/MM/YYYY (pure string transform; no timezone). */
export function formatCalendarYmdAsDdMmYyyy(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Calendar YYYY-MM-DD as short weekday + month + day (e.g. Fri, Apr 4).
 * Interprets the string as a pure calendar date (UTC components).
 */
export function formatCalendarYmdShortWeekday(ymd: string): string {
  const parsed = parseCalendarDateYmd(ymd);
  if (!parsed) return ymd;
  const [y, mo, d] = parsed.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dt);
}
