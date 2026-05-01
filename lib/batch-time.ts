/** Strict `HH:mm` after normalization. */
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Normalizes `<input type="time">` / API values to `HH:mm`:
 * accepts `H:mm`, `HH:mm:ss`, fractional seconds; ignores seconds.
 */
export function normalizeTimeToHHmm(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const noFrac = raw.split(".")[0] ?? raw;
  const segments = noFrac.split(":").filter((s) => s.length > 0);
  if (segments.length < 2) return null;

  const hStr = segments[0] ?? "";
  const mStr = segments[1] ?? "";
  if (!/^\d{1,2}$/.test(hStr) || !/^\d{1,2}$/.test(mStr)) return null;

  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;

  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const out = `${hh}:${mm}`;
  return HH_MM.test(out) ? out : null;
}

export function parseHHmm(value: unknown): string | null {
  return normalizeTimeToHHmm(value);
}

export function minutesFromMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

/**
 * Optional pair: both empty → nulls. One set → error. Both set → end must be after start.
 */
export function validateBatchTimePair(
  startRaw: unknown,
  endRaw: unknown,
):
  | { ok: true; startTime: string | null; endTime: string | null }
  | { ok: false; error: string } {
  const start = typeof startRaw === "string" ? startRaw.trim() : "";
  const end = typeof endRaw === "string" ? endRaw.trim() : "";
  const hasS = start.length > 0;
  const hasE = end.length > 0;

  if (!hasS && !hasE) {
    return { ok: true, startTime: null, endTime: null };
  }

  if (hasS !== hasE) {
    return {
      ok: false,
      error: "Enter both start and end time, or leave both empty.",
    };
  }

  const sp = parseHHmm(start);
  const ep = parseHHmm(end);
  if (!sp || !ep) {
    return { ok: false, error: "Times must be valid HH:mm (24-hour)." };
  }

  if (minutesFromMidnight(ep) <= minutesFromMidnight(sp)) {
    return { ok: false, error: "End time must be after start time." };
  }

  return { ok: true, startTime: sp, endTime: ep };
}

function formatStoredHhmmTo12h(hhmm: string): string {
  const p = normalizeTimeToHHmm(hhmm);
  if (!p) return hhmm.trim();
  const [hs, ms] = p.split(":");
  let h = parseInt(hs, 10);
  const m = ms;
  const period = h >= 12 ? "pm" : "am";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${period}`;
}

/** Human-friendly range from stored `HH:mm` (no timezone; wall-clock schedule). */
export function formatBatchTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start?.trim() || !end?.trim()) return null;
  const a = formatStoredHhmmTo12h(start.trim());
  const b = formatStoredHhmmTo12h(end.trim());
  return `${a} – ${b}`;
}
