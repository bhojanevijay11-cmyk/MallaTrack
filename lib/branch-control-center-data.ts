import { prisma } from "@/lib/prisma";
import {
  getBatchesOrderedByCreatedDesc,
  toBatchApiRecord,
} from "@/lib/batches-queries";
import { resolveBranchHeadCoachLabels } from "@/lib/branch-head-coach";
import { ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";
import { staffUserLabel } from "@/lib/staff-user-label";

const staffSelect = {
  email: true,
  invitesReceived: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { fullName: true },
  },
} as const;

export type BranchControlCenterBatch = ReturnType<typeof toBatchApiRecord>;

export type BranchControlCenterData = {
  branch: { id: string; name: string; createdAt: string };
  headCoachLabels: string[];
  assistantCoachLabels: string[];
  batches: BranchControlCenterBatch[];
};

/**
 * Admin branch overview: staff roster for the branch + batches with coach assignments.
 */
export async function getBranchControlCenterData(
  instituteId: string,
  branchId: string,
): Promise<BranchControlCenterData | null> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, instituteId },
    select: { id: true, name: true, createdAt: true },
  });
  if (!branch) return null;

  const [headUsers, assistantUsers, batchesRaw] = await Promise.all([
    prisma.user.findMany({
      where: {
        instituteId,
        role: ROLE_HEAD_COACH,
        branchId,
      },
      select: staffSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: {
        instituteId,
        role: ROLE_ASSISTANT_COACH,
        assistantAssignments: {
          some: { batch: { branchId, instituteId } },
        },
      },
      select: staffSelect,
      orderBy: { email: "asc" },
    }),
    getBatchesOrderedByCreatedDesc({ kind: "branch", branchId, instituteId }),
  ]);

  const headMap = await resolveBranchHeadCoachLabels(instituteId, [branchId]);
  const branchHeadCoachLabel = headMap.get(branchId) ?? null;

  const batches = batchesRaw.map((b) =>
    toBatchApiRecord(b, {
      branchHeadCoachLabel: branchHeadCoachLabel,
    }),
  );

  return {
    branch: {
      id: branch.id,
      name: branch.name,
      createdAt: branch.createdAt.toISOString(),
    },
    headCoachLabels: headUsers.map((u) => staffUserLabel(u)),
    assistantCoachLabels: assistantUsers.map((u) => staffUserLabel(u)),
    batches,
  };
}
