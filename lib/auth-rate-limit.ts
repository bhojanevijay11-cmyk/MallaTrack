type RateLimitKey = string;

type AttemptWindow = {
  /** epoch ms */
  resetAt: number;
  count: number;
};

const windows = new Map<RateLimitKey, AttemptWindow>();

function nowMs(): number {
  return Date.now();
}

function makeKey(ip: string | null, loginId: string): string {
  const normLogin = loginId.trim().toLowerCase();
  const normIp = ip && ip.trim().length > 0 ? ip.trim() : "unknown-ip";
  return `${normIp}::${normLogin}`;
}

/**
 * Best-effort client IP extraction for server-side auth.
 * This stays intentionally conservative and does not trust unvalidated headers beyond common proxies.
 */
export function extractClientIpFromAuthRequest(
  req:
    | undefined
    | null
    | {
        headers?: Record<string, string | string[] | undefined>;
      },
): string | null {
  const headers = req?.headers;
  if (!headers) return null;

  // Common proxy header. If multiple, take first.
  const xff = headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const xrip = headers["x-real-ip"];
  if (typeof xrip === "string" && xrip.trim().length > 0) return xrip.trim();

  return null;
}

/**
 * In-memory fixed-window rate limit for credential auth attempts.
 *
 * Production note: on serverless/multi-node this is best-effort (per-instance).
 * It's still valuable as an immediate critical-control; a shared store can replace this later.
 */
export function authLoginRateLimitOrThrow(input: { ip: string | null; loginId: string }) {
  // Allow tuning via env without changing behavior elsewhere.
  const maxAttempts =
    Number.parseInt(process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? "", 10) || 10;
  const windowMs =
    Number.parseInt(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS ?? "", 10) || 5 * 60 * 1000;

  // If misconfigured to disable, fail safe (no unlimited auth attempts).
  if (!Number.isFinite(maxAttempts) || maxAttempts <= 0) {
    throw new Error("Auth is temporarily unavailable.");
  }

  const key = makeKey(input.ip, input.loginId);
  const t = nowMs();
  const existing = windows.get(key);
  if (!existing || existing.resetAt <= t) {
    windows.set(key, { resetAt: t + windowMs, count: 1 });
    return;
  }

  existing.count += 1;
  if (existing.count > maxAttempts) {
    throw new Error("Too many login attempts. Try again later.");
  }

  // Opportunistic cleanup to cap memory growth.
  if (windows.size > 10_000) {
    for (const [k, w] of windows) {
      if (w.resetAt <= t) windows.delete(k);
      if (windows.size <= 8_000) break;
    }
  }
}

