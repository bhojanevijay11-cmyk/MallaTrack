/** Shapes returned by GET /api/progress/assessments (list item). */
export type ProgressAssessmentListItem = {
  id: string;
  instituteId: string;
  studentId: string;
  batchId: string;
  assessmentDate: string;
  periodType: string;
  periodKey: string | null;
  status: string;
  strengthScore: number | null;
  flexibilityScore: number | null;
  techniqueScore: number | null;
  disciplineScore: number | null;
  overallScore: number | null;
  coachNotes: string | null;
  assessmentIndicator: string | null;
  authorUserId: string;
  /** Present on API list/detail payloads when `authorUser` is joined (e.g. review queue). */
  authorUser?: { id: string; email: string } | null;
  submittedAt: string | null;
  submittedByUserId: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  student: { id: string; fullName: string };
  batch: {
    id: string;
    name: string | null;
    /** Branch location / center label when the batch is linked to a branch. */
    branchName?: string | null;
  };
};
