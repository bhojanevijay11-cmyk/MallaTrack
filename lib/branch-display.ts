/**
 * UI-only: "{institute} — {branch}" when both exist; otherwise the single available label.
 * Use when the surrounding UI does not already show the institute name (avoid duplicate org lines).
 */
export function instituteBranchDisplayLine(
  instituteName: string | null | undefined,
  branchName: string | null | undefined,
): string {
  const org = instituteName?.trim() ?? "";
  const loc = branchName?.trim() ?? "";
  if (org && loc) return `${org} — ${loc}`;
  if (loc) return loc;
  return org;
}
