/**
 * Tenant integrity: deterministic repair vs manual review (grep: tenant-integrity-repair-policy).
 *
 * See docs/tenant-integrity-repair.md for the full matrix.
 *
 * ---------------------------------------------------------------------------
 * SAFE_TO_REPAIR — explicit admin action only; deterministic; no guessing
 * ---------------------------------------------------------------------------
 * - batch.missing_branch
 *   → assign_batch_branch: set branchId when currently null; branch must belong
 *     to the same institute as the batch (admin-chosen branch only).
 *
 * - batch.branch_orphan_fk
 *   → clear_batch_orphan_branch_fk: batch.branchId points to a missing Branch row;
 *     clear branchId to null (removes invalid pointer only; does not pick a branch).
 *
 * - student.batch_orphan_fk
 *   → clear_student_orphan_batch_fk: student.batchId points to a missing Batch row;
 *     clear batchId to null (does not reassign to another batch).
 *
 * ---------------------------------------------------------------------------
 * REQUIRE_MANUAL_REVIEW — surfaced in diagnostics only; no auto-fix
 * ---------------------------------------------------------------------------
 * - batch.branch_institute_mismatch
 * - student.batch_institute_mismatch
 * - student.institute_not_aligned_with_batch
 * - user.head_coach_missing_branch / user.head_coach_invalid_branch
 * - user.assistant_invalid_home_branch
 * - user.assistant_home_branch_vs_batch_assignment (and similar assistant/home conflicts)
 * - batch_assistant.on_batch_missing_branch (fix batch branch first)
 * - progress_assessment.* (all categories: missing student/batch, institute mismatches,
 *   student_current_batch_mismatch, etc.)
 * - attendance.* (institute vs batch, student vs batch, student_current_batch_mismatch;
 *   bounded scan in diagnostics)
 */

export const TENANT_INTEGRITY_REPAIR_POLICY_TAG =
  "tenant-integrity-repair-policy" as const;
