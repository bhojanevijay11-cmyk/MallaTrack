import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { ROLE_ADMIN, ROLE_HEAD_COACH } from "@/lib/roles";

export type CoachStatusValue = "ACTIVE" | "INACTIVE";

export function parseCoachStatusStrict(value: unknown): CoachStatusValue | null {
  if (typeof value !== "string") return null;
  const u = value.trim().toUpperCase();
  if (u === "ACTIVE") return "ACTIVE";
  if (u === "INACTIVE") return "INACTIVE";
  return null;
}

export async function getCoachesOrderedByName(instituteId: string) {
  return prisma.coach.findMany({
    where: { instituteId },
    orderBy: { fullName: "asc" },
  });
}

/**
 * Coach directory visible to the caller. Head coaches see coaches tied to their branch (or unused
 * roster rows with no batch links); admins and other roles keep institute-wide behavior.
 */
export async function getCoachesVisibleToUser(user: SessionUserWithInstitute) {
  if (user.role === ROLE_ADMIN) {
    return getCoachesOrderedByName(user.instituteId);
  }
  if (user.role === ROLE_HEAD_COACH) {
    if (!user.branchId) return [];
    return prisma.coach.findMany({
      where: {
        instituteId: user.instituteId,
        OR: [
          {
            batches: {
              some: { instituteId: user.instituteId, branchId: user.branchId },
            },
          },
          { batches: { none: {} } },
        ],
      },
      orderBy: { fullName: "asc" },
    });
  }
  return getCoachesOrderedByName(user.instituteId);
}

export async function getActiveCoachesCount(instituteId: string) {
  return prisma.coach.count({
    where: { status: "ACTIVE", instituteId },
  });
}

export async function createCoach(input: {
  fullName: string;
  phone: string | null;
  instituteId: string;
}) {
  return prisma.coach.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      status: "ACTIVE",
      instituteId: input.instituteId,
    },
  });
}

export function toCoachApiRecord(coach: {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: coach.id,
    fullName: coach.fullName,
    phone: coach.phone,
    status: coach.status,
    createdAt: coach.createdAt,
    updatedAt: coach.updatedAt,
  };
}
