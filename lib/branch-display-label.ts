/**
 * Display-only: legacy Branch.name values sometimes embed an organization prefix
 * (`Institute/location`, `Institute — location`, or an old org name that no longer
 * matches the row's current institute). For UI, expose the location/center label only.
 */
export function branchLocationDisplayLabel(
  instituteName: string | null | undefined,
  branchName: string | null | undefined,
): string | null {
  const raw = String(branchName ?? "").trim();
  if (!raw) return null;

  const org = String(instituteName ?? "").trim();
  let working = raw;

  if (org) {
    const slashPrefix = `${org}/`;
    if (working.startsWith(slashPrefix)) {
      const rest = working.slice(slashPrefix.length).trim();
      working = rest || working;
    } else {
      const emDashPrefix = `${org} — `;
      if (working.startsWith(emDashPrefix)) {
        const rest = working.slice(emDashPrefix.length).trim();
        working = rest || working;
      }
    }
  }

  const lastSlash = working.lastIndexOf("/");
  if (lastSlash >= 0) {
    const after = working.slice(lastSlash + 1).trim();
    if (after) return after;
  }

  return working;
}
