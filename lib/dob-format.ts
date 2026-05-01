const DD_MM_YYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse strict DD/MM/YYYY → canonical `YYYY-MM-DD` (date-only, no timezone).
 */
export function parseDdMmYyyyToIso(
  input: string,
): { ok: true; iso: string } | { ok: false; message: string } {
  const s = input.trim();
  const m = DD_MM_YYYY.exec(s);
  if (!m) {
    return {
      ok: false,
      message: "Use DD/MM/YYYY with two digits each (e.g. 07/04/2016).",
    };
  }

  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yyyy = parseInt(m[3], 10);

  const utcMs = Date.UTC(yyyy, mm - 1, dd);
  const d = new Date(utcMs);
  if (
    d.getUTCFullYear() !== yyyy ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) {
    return { ok: false, message: "That date is not valid on the calendar." };
  }

  const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return { ok: true, iso };
}

/** Display stored `YYYY-MM-DD` as DD/MM/YYYY; otherwise return raw string (legacy rows). */
export function formatDobForDisplay(stored: string): string {
  const s = stored.trim();
  const iso = ISO_DATE.exec(s);
  if (iso) {
    const [, y, mo, d] = iso;
    return `${d}/${mo}/${y}`;
  }
  return stored;
}
