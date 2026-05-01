/**
 * Set `HEAD_COACH_SCOPE_DEBUG=1` to log head-coach scope resolution (JWT + API).
 * Remove or leave unset in production once incidents are cleared.
 */
export function debugLogHeadCoachScope(payload: Record<string, unknown>): void {
  if (process.env.HEAD_COACH_SCOPE_DEBUG !== "1") return;
  console.log(
    "[head-coach-scope]",
    JSON.stringify({ ...payload, at: new Date().toISOString() }),
  );
}
