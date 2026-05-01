/**
 * Minimal URL helpers for student list ↔ profile ↔ 360 navigation.
 * Forwards only stable query keys already used by `/students` (no new state).
 */

const STUDENTS_LIST_NAV_CONTEXT_KEYS = ["filter", "alert", "readiness"] as const;

export type StudentsListNavContextSource =
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

function isSearchParamsLike(
  x: StudentsListNavContextSource,
): x is { get(name: string): string | null } {
  return typeof (x as { get?: unknown }).get === "function";
}

/** Collect recognized list-context params for reuse on profile/360 links and “back to list”. */
function pickStudentsListNavContext(source: StudentsListNavContextSource): URLSearchParams {
  const out = new URLSearchParams();
  const get = (key: string): string | null => {
    if (isSearchParamsLike(source)) return source.get(key);
    const v = source[key];
    if (v === undefined) return null;
    if (Array.isArray(v)) {
      const first = v[0];
      return typeof first === "string" ? first : null;
    }
    return typeof v === "string" ? v : null;
  };
  for (const key of STUDENTS_LIST_NAV_CONTEXT_KEYS) {
    const raw = get(key)?.trim();
    if (raw) out.set(key, raw);
  }
  return out;
}

/** Returns `?filter=…&…` or empty string. */
export function studentsListNavContextSuffix(source: StudentsListNavContextSource): string {
  const q = pickStudentsListNavContext(source);
  const s = q.toString();
  return s ? `?${s}` : "";
}
