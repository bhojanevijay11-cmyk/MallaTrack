export type ApiErrorCompat =
  | string
  | {
      code?: unknown;
      message?: unknown;
    }
  | null
  | undefined;

/**
 * Client-side compatibility helper for mixed API error shapes.
 * Supports:
 * - legacy: `{ ok: false, error: "message" }` via `getApiErrorMessageFromPayload`
 * - canonical: `{ ok: false, error: { code: "...", message: "..." } }`
 *
 * For payloads that include extra fields (e.g. `existingAssessmentId`), only `error` is read.
 */
export function getApiErrorMessage(
  errorLike: unknown,
  fallback: string,
): string {
  if (typeof errorLike === "string") {
    const t = errorLike.trim();
    return t ? t : fallback;
  }
  if (errorLike && typeof errorLike === "object") {
    const o = errorLike as { message?: unknown };
    if (typeof o.message === "string") {
      const t = o.message.trim();
      return t ? t : fallback;
    }
  }
  return fallback;
}

export function getApiErrorMessageFromPayload(
  payload: unknown,
  fallback: string,
): string {
  if (!payload || typeof payload !== "object") return fallback;
  const p = payload as { error?: unknown };
  if (!("error" in p)) return fallback;
  return getApiErrorMessage(p.error, fallback);
}

/** Use when `fetch` throws or returns a non-JSON body (offline, timeout, proxy error). */
export const NETWORK_RETRY_HINT =
  "Connection interrupted or the server did not respond. Check your network, wait a moment, then retry.";

