import type { InstituteStatus } from "@/lib/institute-status";
import type { AppRole } from "@/lib/roles";

/**
 * Tenant + role identity used for batch/student scope checks (no display fields).
 * Same logical shape as before; defined here as the canonical base for server auth types.
 */
export type SessionScopeUser = {
  id: string;
  role: AppRole;
  branchId: string | null;
  /** Tenant id from session; null if legacy user or not backfilled yet. */
  instituteId: string | null;
  /**
   * From JWT when available. Optional so legacy narrowed `SessionUserWithInstitute` shapes
   * used in server components still type-check; prefer `getSessionUser()` for full identity.
   */
  instituteStatus?: InstituteStatus | null;
};

/**
 * Normalized authenticated app user for server-side authorization and APIs.
 * Returned by getSessionUser when the session is valid and role is a known AppRole.
 */
export type AuthSessionUser = SessionScopeUser & {
  instituteName: string | null;
};
