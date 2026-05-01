import { prisma } from "@/lib/prisma";
import { ROLE_HEAD_COACH } from "@/lib/roles";
import { staffUserLabel } from "@/lib/staff-user-label";

const headCoachUserSelect = {
  branchId: true,
  email: true,
  invitesReceived: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { fullName: true },
  },
} as const;

type HeadCoachUserRow = {
  branchId: string | null;
  email: string;
  invitesReceived: { fullName: string }[];
};

/**
 * Head coach users (User.role = head_coach) keyed by branchId — display labels joined when multiple.
 */
export async function resolveBranchHeadCoachLabels(
  instituteId: string,
  branchIds: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      branchIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0),
    ),
  ];
  if (ids.length === 0) return new Map();

  const rows = (await prisma.user.findMany({
    where: {
      instituteId,
      role: ROLE_HEAD_COACH,
      branchId: { in: ids },
    },
    select: headCoachUserSelect,
  })) as HeadCoachUserRow[];

  const byBranch = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.branchId) continue;
    const label = staffUserLabel(r);
    const cur = byBranch.get(r.branchId) ?? [];
    cur.push(label);
    byBranch.set(r.branchId, cur);
  }
  const out = new Map<string, string>();
  for (const [bid, labels] of byBranch) {
    out.set(bid, labels.join(" · "));
  }
  return out;
}

export async function resolveBranchHeadCoachLabel(
  instituteId: string | null | undefined,
  branchId: string | null | undefined,
): Promise<string | null> {
  if (!instituteId || !branchId) return null;
  const map = await resolveBranchHeadCoachLabels(instituteId, [branchId]);
  return map.get(branchId) ?? null;
}
