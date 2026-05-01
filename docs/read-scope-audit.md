# Read-scope parity audit (institute / branch / batch / parent)

**Date:** 2026-04-21  
**Scope:** Read paths only; multi-tenant model (admin = institute, head coach = branch, assistant = assigned batches, parent = linked children).

**Central helpers:** `lib/authz-prisma-scopes.ts` (`buildStudentScopeWhere`, `buildBatchScopeWhere`, `buildAttendanceScopeWhere`, `buildProgressScopeWhere`, `buildBranchScopeWhere`, `attendanceRowsInstituteOrLegacyNull`), `lib/head-coach-scope.ts` (`headCoachBatchWhereInput`, `headCoachStudentWhereInput`), `lib/scope.ts` (`canAccessStudent`, `canAccessBatch`), `lib/students-queries.ts` (`getStudentsOrderedForScope`, `getStudentByIdWithBatchForUser`), `lib/batches-queries.ts` (`getBatchesOrderedByCreatedDesc`, `getBatchByIdWithStudentsForUser`).

**Diagnostics:** grep `[read-scope]` or set `READ_SCOPE_DEBUG=1` (assistant progress-alert counts; student 360). Existing: `HEAD_COACH_SCOPE_DEBUG`, `branchScopeAuditEnabled()` / head-coach audit logs.

---

## Summary table

| Surface | Entry → API / server | Final scope / Prisma | Risk | Notes / action |
| -------- | -------------------- | -------------------- | ---- | -------------- |
| Students list | `GET /api/students` | `getStudentsOrderedForScope` (mirrors `buildStudentScopeWhere` for HC/asst) | **SAFE** | Head coach: `headCoachStudentWhereInput`. Alerts: drafts are institute-wide IDs then ∩ list (asst/HC). |
| Student detail | `GET /api/students/[id]` | `getStudentByIdWithBatchForUser` → `buildStudentScopeWhere` | **SAFE** | — |
| Student 360 | `app/(staff-app)/students/[id]/360/page.tsx` → `loadStudent360ViewModel` | Row: `getStudentByIdWithBatchForUser`; attendance: `buildAttendanceScopeWhere`; progress: `progressAssessmentScopeWhere`; reviews: `buildStudentReviewListWhere` | **SAFE** | Batch extras query hardened with `instituteId` (defense in depth). Parents cannot reach `/students/*` (route guard). |
| Batches list | `GET /api/batches` | `getBatchesOrderedByCreatedDesc` (`BatchesListScope`) | **SAFE** | Aligns with `buildBatchScopeWhere` semantics. |
| Batch detail / roster | `GET /api/batches/[id]`, roster routes | `getBatchByIdWithStudentsForUser` → `buildBatchScopeWhere` | **SAFE** | — |
| Attendance GET/PUT | `GET/PUT /api/attendance`, submit | `assertAttendanceAccess` → `canAccessBatch`; roster: `buildStudentScopeWhere`; marks: `getAttendanceForBatchDateScoped` → `buildAttendanceScopeWhere` | **SAFE** | — |
| Attendance KPI / trend | Admin dashboard, `getTodayAttendanceRatePercentScoped`, `getAttendanceTrendLast7DaysForUser` | `buildStudentScopeWhere` + `buildAttendanceScopeWhere` | **SAFE** | Admin-only page uses admin user context. |
| Progress V1 API | `GET/POST /api/progress` | `assertStudentForProgress` → `userCanAccessStudentForProgress` → `getStudentsOrderedForScope` | **SAFE** | Same student set as list scope for staff. |
| Progress V2 list / detail | `GET /api/progress/assessments`, `[id]` | `progressAssessmentScopeWhere` + `assertStudentForProgress` / `assertProgressAssessmentAccess` | **SAFE** | Admin: institute-only where; non-admin: `studentId in` scoped ids. |
| Progress review | `POST .../review`, review queue via assessments list + filters | `assertProgressAssessmentAccess` | **SAFE** | Reviewers: admin + head coach only. |
| Progress workspace reporting | `getProgressV2ReportingSnapshot` | `buildProgressScopeWhere` + `buildBatchScopeWhere` + `studentWhereForReportingScope` | **SAFE** | Only admin + head coach; assistants get empty snapshot (by design). |
| Progress alert counts | `getProgressAlertCountsForUser` (dashboards) | `buildProgressScopeWhere` + `studentWhereForReportingScope` + draft ID sets | **SAFE** (was **NEEDS_ALIGNMENT** for asst) | **Fixed:** assistant `pendingCoachFeedbackDrafts` now matches `GET /api/students?alert=PENDING_COACH_FEEDBACK`. |
| Head coach dashboard | `GET /api/head-coach/dashboard`, SSR page | `getHeadCoachDashboardSnapshot` → `buildStudentScopeWhere` / `buildAttendanceScopeWhere`, branch batch helpers | **SAFE** | Uses same scope builders as APIs. |
| Admin dashboard | `app/(staff-app)/admin/page.tsx` | Institute-scoped students/batches; `getProgressV2ReportingSnapshot` / alerts as admin | **SAFE** | — |
| Assistant dashboard | `assistant-coach/page.tsx` | Same alert helper as above | **SAFE** | After pending-feedback count fix. |
| Operational reports | `app/(staff-app)/reports/page.tsx` (admin only) | `getReportsSnapshotForUser` → `buildBatchScopeWhere`, `buildStudentScopeWhere`, `buildAttendanceScopeWhere` | **SAFE** | Admin-only route. `totalActiveCoaches` is institute-wide (intended for admin). |
| Branch control center | Admin branch UI → `getBranchControlCenterData` | Explicit `branchId` + `instituteId` | **SAFE** | — |
| Parents directory (staff) | `GET /api/parents` | Head coach: parents derived from `buildStudentScopeWhere` students; admin: all parents in institute | **SAFE** | — |
| Parent home | `app/parent/page.tsx` → `getParentDashboardBundles` | `parentUserId` + `instituteId`; attendance uses `attendanceRowsInstituteOrLegacyNull` + student linkage | **SAFE** | Legacy null `Attendance.instituteId` allowed only with parent-scoped student filter. |
| Student reviews API | `GET /api/students/[id]/reviews` | `getStudentByIdWithBatchForUser` then `buildStudentReviewListWhere` | **SAFE** | Parent: published + parent-visible only. |

---

## Duplicated / parallel logic (not wrong, but watch for drift)

| Area | Paths | Risk |
| ---- | ----- | ---- |
| Student list for progress | `progressAssessmentScopeWhere` uses `getStudentsOrderedForScope` from `scopeForProgressUser`; student APIs use `buildStudentScopeWhere` | **LOW** | Both rely on `headCoachStudentWhereInput` / assistant batch links; keep changes in sync via shared helpers. |
| Entity checks | `canAccessStudent` / `canAccessBatch` vs Prisma `where` builders | **LOW** | `canAccessStudent` fails closed on null `batch.branchId` for head coach; matches `headCoachStudentWhereInput`. |

---

## Legacy / nullable data (silent exclusion)

| Issue | Impact |
| ----- | ------ |
| `Batch.branchId` null | Head coach: batch and students excluded until backfilled (intended). |
| `Student.batchId` null | Excluded from head coach + assistant roster; included for admin institute list. |
| Staff `buildAttendanceScopeWhere` uses `instituteId: user.instituteId` (no `attendanceRowsInstituteOrLegacyNull`) | Legacy attendance rows with `instituteId: null` are **not** included for staff; parent path **does** include them when student is parent-linked. If legacy staff-marked rows used null instituteId, staff views could under-count vs parent. **Flag:** **NEEDS_ALIGNMENT** only if such legacy rows exist in production. |

---

## Changes made in this pass

1. **`lib/progress-alerts-queries.ts`** — Assistant `pendingCoachFeedbackDrafts` aligned with students list alert filter; optional `[read-scope][progress-alerts]` log when `READ_SCOPE_DEBUG=1`.
2. **`lib/student-360-data.ts`** — Batch lookup for extras constrained by `instituteId`; `[read-scope][student-360]` log when `READ_SCOPE_DEBUG=1`; dev logs include `branchId` and `scopePath`.
3. **`lib/authz-prisma-scopes.ts`** — Doc pointer to this file.

---

## Follow-ups (not changed here)

- If legacy attendance exists with `instituteId: null` for batches still used by staff, consider extending staff attendance scope symmetrically to parent (narrow OR, still batch/student scoped) after data review.
- `userCanAccessStudentForProgress` / `progressAssessmentScopeWhere` load full scoped student lists; performance hardening is out of scope for this audit.
