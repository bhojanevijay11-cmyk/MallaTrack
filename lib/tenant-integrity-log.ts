/**
 * Grep: [tenant-integrity][repair] | [tenant-integrity][guardrail]
 * Structured logs for admin repairs and read-path guardrails (removable / grep-friendly).
 */

export type TenantIntegrityLogPayload = {
  entityType: string;
  recordId: string;
  instituteId: string;
  reason: string;
  /** Optional extra context (keep small). */
  detail?: Record<string, string | null | undefined>;
};

function safeJson(payload: TenantIntegrityLogPayload & { tag: string }) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({
      tag: payload.tag,
      entityType: payload.entityType,
      recordId: payload.recordId,
      instituteId: payload.instituteId,
      reason: payload.reason,
    });
  }
}

export function logTenantIntegrityRepair(
  payload: TenantIntegrityLogPayload & { action: string; actorUserId: string },
): void {
  console.warn(
    "[tenant-integrity][repair]",
    safeJson({
      tag: "[tenant-integrity][repair]",
      ...payload,
    }),
  );
}

export function logTenantIntegrityGuardrail(payload: TenantIntegrityLogPayload): void {
  console.warn(
    "[tenant-integrity][guardrail]",
    safeJson({
      tag: "[tenant-integrity][guardrail]",
      ...payload,
    }),
  );
}
