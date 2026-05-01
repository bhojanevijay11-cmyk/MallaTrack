/** Encode/decode reps×sets ↔ legacy expectedPerformance / observedPerformance strings (API compatibility). */

export const METRIC_INT_MIN = 0;
export const METRIC_INT_MAX = 1_000_000;

export function clampMetricInt(n: number): number {
  if (!Number.isFinite(n)) return METRIC_INT_MIN;
  return Math.min(METRIC_INT_MAX, Math.max(METRIC_INT_MIN, Math.trunc(n)));
}

/** Maps reps/sets text ↔ API `expectedPerformance` / `observedPerformance`. */
export function encodeExpectedPerformance(reps: string, sets: string): string {
  const r = reps.trim();
  const s = sets.trim();
  if (!r && !s) return "";
  if (/^\d+$/.test(r) && /^\d+$/.test(s)) return `${r} reps × ${s} sets`;
  if (/^\d+$/.test(r) && !s) return `${r} reps`;
  if (/^\d+$/.test(s) && !r) return `${s} sets`;
  return [r, s].filter(Boolean).join(" · ");
}

export function decodeExpectedPerformance(exp: string): { reps: string; sets: string } {
  const t = exp.trim();
  if (!t) return { reps: "", sets: "" };
  const paired = t.match(/^(\d+)\s*reps?\s*[×x]\s*(\d+)\s*sets?$/i);
  if (paired) return { reps: paired[1], sets: paired[2] };
  const repsOnly = t.match(/^(\d+)\s*reps?$/i);
  if (repsOnly) return { reps: repsOnly[1], sets: "" };
  const setsOnly = t.match(/^(\d+)\s*sets?$/i);
  if (setsOnly) return { reps: "", sets: setsOnly[1] };
  return { reps: t, sets: "" };
}

/** Canonical string from structured ints for backward-compatible string columns. */
export function encodePerformanceFromInts(
  reps: number | null,
  sets: number | null,
): string | null {
  if (reps === null && sets === null) return null;
  const s = encodeExpectedPerformance(
    reps != null ? String(reps) : "",
    sets != null ? String(sets) : "",
  );
  return s === "" ? null : s;
}

/** If the whole decoded segment is digits, return as metric int; otherwise null (legacy prose). */
export function metricIntFromDecodedSegment(segment: string): number | null {
  const t = segment.trim();
  if (!t || !/^\d+$/.test(t)) return null;
  return clampMetricInt(Number.parseInt(t, 10));
}

/** UI readout: prefer structured reps/sets, else legacy free text (expected/observed columns). */
export function formatRepsSetsOrLegacy(
  reps: number | null | undefined,
  sets: number | null | undefined,
  legacy: string | null | undefined,
): string {
  if (reps != null || sets != null) {
    const r = reps != null ? String(reps) : "—";
    const s = sets != null ? String(sets) : "—";
    return `${r} reps · ${s} sets`;
  }
  return (legacy ?? "").trim() || "—";
}
