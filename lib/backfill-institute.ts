import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultInstitute } from "@/lib/institute-default";

export type BackfillInstituteOwnershipResult = {
  instituteId: string;
  instituteName: string;
  branchRows: number;
  userFromBranchRows: number;
  userDefaultRows: number;
  batchFromBranchRows: number;
  batchDefaultRows: number;
  studentFromBatchRows: number;
  studentDefaultRows: number;
  coachRows: number;
  attendanceRows: number;
};

/**
 * Idempotent: fills nullable instituteId for legacy rows using one default tenant.
 * Safe when multiple institutes already exist: only updates rows where instituteId IS NULL,
 * and uses the oldest institute by createdAt as the legacy default (or creates "Default").
 *
 * Order: Branch → User → Batch → Student → Coach → Attendance (Attendance last so Batch.instituteId is set).
 */
export async function backfillInstituteOwnership(): Promise<BackfillInstituteOwnershipResult> {
  const { id: instituteId, name: instituteName } = await ensureDefaultInstitute();

  const branchRows = (
    await prisma.branch.updateMany({
      where: { instituteId: null },
      data: { instituteId },
    })
  ).count;

  const userFromBranchRows = Number(
    await prisma.$executeRaw(
      Prisma.sql`
      UPDATE "User" SET "instituteId" = (
        SELECT "instituteId" FROM "Branch" WHERE "Branch"."id" = "User"."branchId"
      )
      WHERE "User"."instituteId" IS NULL AND "User"."branchId" IS NOT NULL
    `,
    ),
  );

  const userDefaultRows = (
    await prisma.user.updateMany({
      where: { instituteId: null },
      data: { instituteId },
    })
  ).count;

  const batchFromBranchRows = Number(
    await prisma.$executeRaw(
      Prisma.sql`
      UPDATE "Batch" SET "instituteId" = (
        SELECT "instituteId" FROM "Branch" WHERE "Branch"."id" = "Batch"."branchId"
      )
      WHERE "Batch"."instituteId" IS NULL AND "Batch"."branchId" IS NOT NULL
    `,
    ),
  );

  const batchDefaultRows = (
    await prisma.batch.updateMany({
      where: { instituteId: null },
      data: { instituteId },
    })
  ).count;

  const studentFromBatchRows = Number(
    await prisma.$executeRaw(
      Prisma.sql`
      UPDATE "Student" SET "instituteId" = (
        SELECT "instituteId" FROM "Batch" WHERE "Batch"."id" = "Student"."batchId"
      )
      WHERE "Student"."instituteId" IS NULL AND "Student"."batchId" IS NOT NULL
    `,
    ),
  );

  const studentDefaultRows = (
    await prisma.student.updateMany({
      where: { instituteId: null },
      data: { instituteId },
    })
  ).count;

  const coachRows = (
    await prisma.coach.updateMany({
      where: { instituteId: null },
      data: { instituteId },
    })
  ).count;

  const attendanceRows = Number(
    await prisma.$executeRaw(
      Prisma.sql`
      UPDATE "Attendance" SET "instituteId" = (
        SELECT "instituteId" FROM "Batch" WHERE "Batch"."id" = "Attendance"."batchId"
      )
      WHERE "Attendance"."instituteId" IS NULL
    `,
    ),
  );

  return {
    instituteId,
    instituteName,
    branchRows,
    userFromBranchRows,
    userDefaultRows,
    batchFromBranchRows,
    batchDefaultRows,
    studentFromBatchRows,
    studentDefaultRows,
    coachRows,
    attendanceRows,
  };
}
