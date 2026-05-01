export type InviteListStatus = "pending" | "used" | "expired";

/** Derive list status from persisted invite fields (no extra status column). */
export function deriveInviteListStatus(
  usedAt: Date | null,
  expiresAt: Date,
  now: Date = new Date(),
): InviteListStatus {
  if (usedAt) return "used";
  if (expiresAt <= now) return "expired";
  return "pending";
}
