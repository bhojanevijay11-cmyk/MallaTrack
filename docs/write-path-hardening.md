# Write-path hardening (tenant / branch / batch integrity)

**Date:** 2026-04-21  
**Policy:** Fail closed. Batches used for roster, attendance, progress V1/V2, or assistant assignment must have a **non-null `branchId`** in the same institute as the acting user and referenced students.

**Shared helpers:** `lib/write-scope-validation.ts` (`assertBatchHasBranchId`, `resolveBatchInInstitute`, `resolveStudentInInstitute`, `validateStudentBatchInstituteAlignment`), existing `lib/batch-branch-assignment.ts`, `lib/scope.ts` (`canAccessBatch`, `canAccessStudent`), `lib/batch-roster-authorization.ts`.

---

## A. Write-path audit summary

| Path | Scope / tenant checks | Change in this pass |
|------|------------------------|---------------------|
| `POST/GET /api/batches` | Create: admin requires branch; HC uses session branch. List: role scope. | No change (already strict on create). |
| `PATCH/DELETE /api/batches/[id]` | `buildBatchScopeWhere` before mutate; HC cannot change branch/name; admin branch via `validateBatchBranchChangeForAdmin`. | **Block clearing branch** (non-null → null) in `validateBatchBranchChangeForAdmin`. |
| `POST /api/batches/[id]/students` | `verifyStudentIdsAssignableToBatch` + institute batch row. | **Require target batch `branchId`** (`assertBatchHasBranchId`). |
| `POST/DELETE /api/batches/[id]/assistants` | `canAccessBatch` + assistant/batch branch rules. | **POST:** reject if batch has no branch. |
| `PATCH /api/students/[id]` | `getStudentByIdWithBatchForUser`; batch assign uses `canAccessBatch` + institute match. | **Require batch branch** before assign; **`setStudentBatchAssignment`** validates institute + branch; **updates** use `where: { instituteId }`; structured errors for assignment failures. |
| `setStudentBatchAssignment` | — | **Institute alignment + branch required** for non-null batch; throws `STUDENT_OR_BATCH_NOT_FOUND` / `STUDENT_BATCH_INSTITUTE_MISMATCH` / `BATCH_BRANCH_REQUIRED`. |
| `POST /api/students` | Admin-only create; `instituteId` from session. | No change. |
| `PUT /api/attendance`, `POST /api/attendance/submit` | `canAccessBatch` + `saveAttendanceBulk` student-in-batch. | **`saveAttendanceBulk`:** require batch `branchId`. |
| `POST /api/progress/assessments` | `assertStudentForProgress`, `assertBatchAccess`, HC branch assert, student.batchId === batchId. | **Require batch `branchId`** before create. |
| `PATCH /api/progress/assessments/[id]` | `assertProgressAssessmentAccess`; batch change matches student roster + HC branch. | **Require new batch `branchId`** when `batchId` patched. |
| `POST /api/progress/assessments/[id]/submit` | Access + HC branch + author. | **Re-read student:** `batchId` must still match assessment (409 if roster drift). |
| `POST /api/progress` (V1 entries) | `assertStudentForProgress`. | **Student must have batch** in institute with **non-null branch**. |
| `POST /api/progress/assessments/[id]/review` | Admin/HC + `assertProgressAssessmentAccess`. | No change. |
| `POST /api/students/[id]/reviews` | Student in scope via `getStudentByIdWithBatchForUser`; `instituteId` on create. | No change. |
| `PATCH /api/reviews/[reviewId]` | `instituteId` + `canAccessStudent`. | No change. |
| `POST /api/coaches` | Admin + `instituteId`. | No change. |
| `POST /api/invites` | Admin; branch belongs to institute if set. | No change. |
| `PUT /api/invites` (accept) | Token → user + institute. | **Verify `invite.branchId` exists under `invite.instituteId` when set.** |
| `POST /api/onboarding` | Transaction + `user.instituteId === null` gate; creates institute + branch. | No change. |
| `POST /api/auth/register` | Default institute + optional default branch for HC. | No change. |

---

## B. Files changed

- `lib/write-scope-validation.ts` (new)
- `lib/batch-branch-assignment.ts`
- `lib/students-queries.ts`
- `lib/batch-roster-authorization.ts`
- `lib/attendance-queries.ts`
- `app/api/students/[id]/route.ts`
- `app/api/batches/[id]/assistants/route.ts`
- `app/api/progress/assessments/route.ts`
- `app/api/progress/assessments/[id]/route.ts`
- `app/api/progress/assessments/[id]/submit/route.ts`
- `app/api/progress/route.ts`
- `app/api/invites/route.ts`
- `docs/write-path-hardening.md` (this file)

---

## C. Validation rules added (per helper / route)

| Rule | Where |
|------|--------|
| Batch must have non-null trimmed `branchId` for roster/attendance/progress/assistant-assign | `assertBatchHasBranchId` → roster, `saveAttendanceBulk`, assessment create/PATCH batch, V1 progress POST, student batch assign paths, assistants POST |
| Student and batch same `instituteId` on programmatic batch assign | `setStudentBatchAssignment` (throws); `validateStudentBatchInstituteAlignment` available for reuse |
| Admin cannot remove a batch’s branch once set | `validateBatchBranchChangeForAdmin` |
| Submit assessment: live `student.batchId` === assessment `batchId` | `submit/route.ts` |
| Invite accept: stored branch id must exist in institute | `PUT /api/invites` |
| Parent-only student update: row constrained by `instituteId` | `PATCH /api/students/[id]` |

---

## D. Remaining risky / follow-up write paths

- **Session refresh:** writes still trust `getAuthorizedAppContext` / `requireRoleWithInstitute`; optional hardening is re-loading `User` from DB for sensitive mutations (not done here).
- **Legacy batches with `branchId: null`:** cannot add students, attendance, progress, or assistants until an admin sets a branch (by design).
- **`PATCH /api/branches/[id]`** and other admin branch/coach directory routes were not re-audited line-by-line in this pass; they remain institute-scoped as before.
