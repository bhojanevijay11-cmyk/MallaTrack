# Tenant integrity: diagnostics, guardrails, and repairs

This document matches the code policy in `lib/tenant-integrity-repair-policy.ts` and the runtime checks in `lib/tenant-integrity-guardrails.ts`.

## Category classification

### SAFE_TO_REPAIR (explicit admin only, deterministic)

| Diagnostics category | Admin action | Notes |
| -------------------- | ------------ | ----- |
| `batch.missing_branch` | `assign_batch_branch` | Admin must supply `branchId`. No auto-picked branch. |
| `batch.branch_orphan_fk` | `clear_batch_orphan_branch_fk` | Sets `branchId` to `null` when the Branch row is missing. Does not assign a replacement branch. |
| `student.batch_orphan_fk` | `clear_student_orphan_batch_fk` | Sets `batchId` to `null` when the Batch row is missing. Does not assign a replacement batch. |

### REQUIRE_MANUAL_REVIEW (diagnostics only; no auto-fix in app)

| Category | Why |
| -------- | --- |
| `batch.branch_institute_mismatch` | Ambiguous which side is canonical. |
| `student.batch_institute_mismatch` | Ambiguous correction path. |
| `student.institute_not_aligned_with_batch` | Needs data entry / roster decisions. |
| `user.head_coach_missing_branch` / `user.head_coach_invalid_branch` | Staff profile fixes, not data “repair” helpers. |
| `user.assistant_invalid_home_branch` / `user.assistant_home_branch_vs_batch_assignment` | Policy and assignment decisions. |
| `batch_assistant.on_batch_missing_branch` | Fix batch branch first (`assign_batch_branch`). |
| `progress_assessment.*` | Historical / semantic; may need coach workflow, not silent rewrite. |
| `attendance.*` | Historical; diagnostics use a bounded scan (newest 2000 rows). |

## Supported repairs (API)

`POST /api/admin/tenant-integrity/repair` (admin session, same institute as caller).

Body examples:

```json
{ "action": "assign_batch_branch", "batchId": "…", "branchId": "…" }
```

```json
{ "action": "clear_batch_orphan_branch_fk", "batchId": "…" }
```

```json
{ "action": "clear_student_orphan_batch_fk", "studentId": "…" }
```

Logs: grep `[tenant-integrity][repair]`.

## Guardrails (read paths)

Invalid or inconsistent tenant linkage is **excluded** from operational queries and API behavior (404 / empty lists where appropriate), not silently mixed into results.

- Prisma `where` helpers: `operationalBatchWhereInput`, `operationalStudentWhereInput` in `lib/tenant-integrity-guardrails.ts`, composed in `lib/authz-prisma-scopes.ts`, `lib/batches-queries.ts`, `lib/students-queries.ts`, `lib/head-coach-scope.ts`, and `lib/scope.ts` (`canAccessBatch` / `canAccessStudent`).
- Progress V2: assessments must pass `progressAssessmentRecordOperationallyVisible` (includes student current batch vs assessment batch alignment).
- Attendance: rows filtered with `attendanceRecordOperationallyVisible` where lists are returned from composite queries.

Logs: grep `[tenant-integrity][guardrail]`.

Batches that fail guardrails (e.g. missing branch) disappear from normal staff batch lists; use diagnostics + the repair API with explicit ids to fix them.

## Write validation (recurrence)

New writes continue to enforce institute/branch/batch rules (e.g. `lib/write-scope-validation.ts`, batch branch assignment validation). Guardrails cover legacy or drifted rows without silent cross-tenant exposure.

## Limitations

- Attendance integrity in diagnostics is **bounded** (see `limits.attendanceRowsScannedMax` in the tenant integrity report); very old bad rows may not appear in the report but are still excluded when read paths load those rows with relations.
