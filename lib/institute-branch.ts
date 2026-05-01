import { prisma } from "@/lib/prisma";

/** When exactly one Branch row exists globally, return its id — legacy helper. */
export async function getSingleInstituteBranchId(): Promise<string | null> {
  const rows = await prisma.branch.findMany({
    take: 2,
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.length === 1 ? rows[0].id : null;
}

/** When exactly one Branch exists for this institute, return its id (safe default for batch create). */
export async function getSingleBranchIdForInstitute(
  instituteId: string,
): Promise<string | null> {
  const rows = await prisma.branch.findMany({
    where: { instituteId },
    take: 2,
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.length === 1 ? rows[0].id : null;
}
