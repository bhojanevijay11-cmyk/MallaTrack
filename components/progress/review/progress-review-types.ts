import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";

export type ProgressAssessmentExerciseDTO = {
  id: string;
  sortOrder: number;
  exerciseName: string;
  expectedPerformance: string | null;
  observedPerformance: string | null;
  note: string | null;
  /** Present when persisted; older rows may be null — use legacy strings + decode. */
  targetReps?: number | null;
  targetSets?: number | null;
  completedReps?: number | null;
  completedSets?: number | null;
};

/** GET /api/progress/assessments/[id] payload (subset used by review UI). */
export type ProgressAssessmentDetailPayload = ProgressAssessmentListItem & {
  student: { id: string; fullName: string; batchId: string | null };
  batch: { id: string; name: string | null };
  authorUser: { id: string; email: string };
  submittedByUser: { id: string; email: string } | null;
  reviewedByUser: { id: string; email: string } | null;
  /** Present on GET /api/progress/assessments/[id]; may be omitted in older cached payloads. */
  exercises?: ProgressAssessmentExerciseDTO[];
};
