import type { Prisma } from "@prisma/client";

export const studentReviewListInclude = {
  author: { select: { email: true } },
} satisfies Prisma.StudentReviewInclude;

export type StudentReviewListRow = Prisma.StudentReviewGetPayload<{
  include: typeof studentReviewListInclude;
}>;

export function serializeStudentReview(row: StudentReviewListRow) {
  return {
    id: row.id,
    studentId: row.studentId,
    instituteId: row.instituteId,
    authorUserId: row.authorUserId,
    authorRole: row.authorRole,
    authorEmail: row.author.email,
    title: row.title,
    note: row.note,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
