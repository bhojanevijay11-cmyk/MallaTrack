import { prisma } from "@/lib/prisma";
import { ensureDefaultInstitute } from "@/lib/institute-default";

/** Ensures at least one branch exists; used for registration and legacy backfill. */
export async function ensureDefaultBranch(): Promise<{ id: string; name: string }> {
  const existing = await prisma.branch.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, instituteId: true },
  });
  if (existing) {
    if (existing.instituteId == null) {
      const inst = await ensureDefaultInstitute();
      await prisma.branch.update({
        where: { id: existing.id },
        data: { instituteId: inst.id },
      });
    }
    return { id: existing.id, name: existing.name };
  }
  const inst = await ensureDefaultInstitute();
  return prisma.branch.create({
    data: { name: "Main", instituteId: inst.id },
    select: { id: true, name: true },
  });
}
