import { prisma } from "@/lib/prisma";
import { ROLE_PARENT } from "@/lib/roles";

export async function validateParentUserIdForInstitute(
  instituteId: string,
  parentUserId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (parentUserId === null) return { ok: true };
  const u = await prisma.user.findFirst({
    where: { id: parentUserId, instituteId, role: ROLE_PARENT },
    select: { id: true },
  });
  if (!u) return { ok: false, message: "Parent user not found." };
  return { ok: true };
}
