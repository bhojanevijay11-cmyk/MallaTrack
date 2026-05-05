import type { ProgressAssessment, ProgressAssessmentExercise, Student, Batch, User } from "@prisma/client";
import { overallScoreForDisplay } from "@/lib/progress-assessment-category-scores";

export type ProgressAssessmentListRow = ProgressAssessment & {
  student: Pick<Student, "id" | "fullName">;
  batch: Pick<Batch, "id" | "name"> & {
    branch: { name: string | null } | null;
  };
  authorUser: Pick<User, "id" | "email">;
};

export type ProgressAssessmentDetail = ProgressAssessment & {
  student: Pick<Student, "id" | "fullName" | "batchId">;
  batch: Pick<Batch, "id" | "name"> & {
    branch: { name: string | null } | null;
  };
  authorUser: Pick<User, "id" | "email">;
  submittedByUser: Pick<User, "id" | "email"> | null;
  reviewedByUser: Pick<User, "id" | "email"> | null;
  exercises: ProgressAssessmentExercise[];
};

function userSnippet(u: Pick<User, "id" | "email"> | null) {
  if (!u) return null;
  return { id: u.id, email: u.email };
}

export function serializeProgressAssessmentListRow(row: ProgressAssessmentListRow) {
  return {
    id: row.id,
    instituteId: row.instituteId,
    studentId: row.studentId,
    batchId: row.batchId,
    assessmentDate: row.assessmentDate.toISOString(),
    periodType: row.periodType,
    periodKey: row.periodKey,
    status: row.status,
    strengthScore: row.strengthScore,
    flexibilityScore: row.flexibilityScore,
    techniqueScore: row.techniqueScore,
    disciplineScore: row.disciplineScore,
    overallScore: overallScoreForDisplay({
      strengthScore: row.strengthScore,
      flexibilityScore: row.flexibilityScore,
      techniqueScore: row.techniqueScore,
      disciplineScore: row.disciplineScore,
      storedOverallScore: row.overallScore,
    }),
    coachNotes: row.coachNotes,
    assessmentIndicator: row.assessmentIndicator,
    authorUserId: row.authorUserId,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    submittedByUserId: row.submittedByUserId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedByUserId: row.reviewedByUserId,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    student: { id: row.student.id, fullName: row.student.fullName },
    batch: {
      id: row.batch.id,
      name: row.batch.name,
      branchName: row.batch.branch?.name?.trim() ? row.batch.branch.name.trim() : null,
    },
    authorUser: userSnippet(row.authorUser),
  };
}

export function serializeProgressAssessmentDetail(row: ProgressAssessmentDetail) {
  return {
    ...serializeProgressAssessmentListRow(row),
    student: {
      id: row.student.id,
      fullName: row.student.fullName,
      batchId: row.student.batchId,
    },
    batch: {
      id: row.batch.id,
      name: row.batch.name,
      branchName: row.batch.branch?.name?.trim() ? row.batch.branch.name.trim() : null,
    },
    authorUser: userSnippet(row.authorUser),
    submittedByUser: userSnippet(row.submittedByUser),
    reviewedByUser: userSnippet(row.reviewedByUser),
    exercises: [...(row.exercises ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((e) => ({
        id: e.id,
        sortOrder: e.sortOrder,
        exerciseName: e.exerciseName,
        expectedPerformance: e.expectedPerformance,
        observedPerformance: e.observedPerformance,
        note: e.note,
        targetReps: e.targetReps ?? null,
        targetSets: e.targetSets ?? null,
        completedReps: e.completedReps ?? null,
        completedSets: e.completedSets ?? null,
      })),
  };
}

export const progressAssessmentListSelect = {
  id: true,
  instituteId: true,
  studentId: true,
  batchId: true,
  assessmentDate: true,
  periodType: true,
  periodKey: true,
  status: true,
  strengthScore: true,
  flexibilityScore: true,
  techniqueScore: true,
  disciplineScore: true,
  overallScore: true,
  coachNotes: true,
  assessmentIndicator: true,
  authorUserId: true,
  submittedAt: true,
  submittedByUserId: true,
  reviewedAt: true,
  reviewedByUserId: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      id: true,
      fullName: true,
      instituteId: true,
      batchId: true,
      batch: {
        select: {
          instituteId: true,
          branchId: true,
          branch: { select: { instituteId: true } },
        },
      },
    },
  },
  batch: {
    select: {
      id: true,
      name: true,
      instituteId: true,
      branchId: true,
      branch: { select: { instituteId: true, name: true } },
    },
  },
  authorUser: { select: { id: true, email: true } },
} as const;

export const progressAssessmentDetailInclude = {
  student: {
    select: {
      id: true,
      fullName: true,
      batchId: true,
      instituteId: true,
      batch: {
        select: {
          instituteId: true,
          branchId: true,
          branch: { select: { instituteId: true } },
        },
      },
    },
  },
  batch: {
    select: {
      id: true,
      name: true,
      instituteId: true,
      branchId: true,
      branch: { select: { instituteId: true, name: true } },
    },
  },
  authorUser: { select: { id: true, email: true } },
  submittedByUser: { select: { id: true, email: true } },
  reviewedByUser: { select: { id: true, email: true } },
  exercises: { orderBy: { sortOrder: "asc" as const } },
} as const;
