import { prisma } from "@/lib/prisma";

/** Name used when creating the first tenant row (single-DB legacy installs). */
export const DEFAULT_INSTITUTE_NAME = "Default";

/**
 * Returns the oldest institute, or creates one row for legacy single-tenant databases.
 * Does not create a second institute if any already exist.
 */
export async function ensureDefaultInstitute(): Promise<{ id: string; name: string }> {
  const first = await prisma.institute.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (first) return first;
  return prisma.institute.create({
    data: { name: DEFAULT_INSTITUTE_NAME },
    select: { id: true, name: true },
  });
}
