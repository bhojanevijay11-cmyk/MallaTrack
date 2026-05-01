/**
 * Institute lifecycle for platform emergency control (string field on `Institute.status`).
 */

export const INSTITUTE_STATUS_ACTIVE = "active" as const;
export const INSTITUTE_STATUS_DISABLED = "disabled" as const;

export type InstituteStatus =
  | typeof INSTITUTE_STATUS_ACTIVE
  | typeof INSTITUTE_STATUS_DISABLED;

export function isInstituteStatus(value: unknown): value is InstituteStatus {
  return (
    value === INSTITUTE_STATUS_ACTIVE || value === INSTITUTE_STATUS_DISABLED
  );
}

/** Invalid / missing values are treated as active for safe read paths. */
export function normalizeInstituteStatus(
  raw: string | null | undefined,
): InstituteStatus {
  if (raw === INSTITUTE_STATUS_DISABLED) return INSTITUTE_STATUS_DISABLED;
  return INSTITUTE_STATUS_ACTIVE;
}
