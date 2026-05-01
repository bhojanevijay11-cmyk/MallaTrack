import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { parseDdMmYyyyToIso } from "@/lib/dob-format";
import { getStudentsOrderedForScope, type StudentsListScope } from "@/lib/students-queries";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { studentPayloadForRole } from "@/lib/students-api";
import { getIndiaTodayCalendarYmd } from "@/lib/datetime-india";
import {
  getAttentionStudentIdsForBranch,
  getLowAttendanceAttentionStudentIdsForBranch,
} from "@/lib/head-coach-branch-data";
import {
  APP_STAFF_ROLES,
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
} from "@/lib/roles";
import { validateParentUserIdForInstitute } from "@/lib/parent-user-validation";
import { assertBatchHasBranchId } from "@/lib/write-scope-validation";
import { PROGRESS_ALERT_TYPE } from "@/lib/progress-alerts";
import { getStudentIdsWithPendingParentVisibleCoachFeedbackDrafts } from "@/lib/student-review-attention";
import { debugLogHeadCoachScope } from "@/lib/head-coach-scope-debug";
import {
  countMatchedActiveBatchesHeadCoach,
  runHeadCoachScopeAudit,
} from "@/lib/head-coach-scope-audit";
import {
  branchScopeAuditEnabled,
  getBranchScopeConsistencyCounts,
  getHeadCoachEmptyScopeExtraStats,
  logAssistantBatchAudit,
  logHeadCoachBranchAudit,
  logStudentBatchBranchAudit,
} from "@/lib/branch-scope-audit";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/students";

export async function POST(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, [ROLE_ADMIN]);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }

  if (!body || typeof body !== "object") {
    return apiError({
      code: "STUDENT_CREATE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }

  const b = body as Record<string, unknown>;
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  const dobRaw = typeof b.dob === "string" ? b.dob.trim() : "";
  const gender = typeof b.gender === "string" ? b.gender.trim() : "";

  if (!fullName || !dobRaw || !gender) {
    return apiError({
      code: "STUDENT_CREATE_BAD_REQUEST",
      message: "Missing required fields: fullName, dob, gender.",
      status: 400,
    });
  }

  const dobParsed = parseDdMmYyyyToIso(dobRaw);
  if (!dobParsed.ok) {
    return apiError({
      code: "STUDENT_CREATE_BAD_REQUEST",
      message: dobParsed.message,
      status: 400,
    });
  }
  const dob = dobParsed.iso;

  const parentName = typeof b.parentName === "string" ? b.parentName.trim() : undefined;
  const parentPhone = typeof b.parentPhone === "string" ? b.parentPhone.trim() : undefined;
  const emergencyContact =
    typeof b.emergencyContact === "string" ? b.emergencyContact.trim() : undefined;

  const rawBatchId = b.batchId;
  if (typeof rawBatchId !== "string" || !rawBatchId.trim()) {
    return apiError({
      code: "STUDENT_CREATE_BAD_REQUEST",
      message: "Student must be assigned to a batch.",
      status: 400,
    });
  }
  const batchId = rawBatchId.trim();
  const batchRow = await prisma.batch.findFirst({
    where: { id: batchId, instituteId: user.instituteId },
    select: { id: true, instituteId: true, branchId: true },
  });
  if (!batchRow) {
    return apiError({
      code: "STUDENT_CREATE_INVALID_BATCH",
      message: "Invalid batch for this institute.",
      status: 400,
    });
  }
  const batchBranchOk = assertBatchHasBranchId(batchRow.branchId);
  if (!batchBranchOk.ok) {
    return apiError({
      code: "STUDENT_CREATE_BAD_REQUEST",
      message: batchBranchOk.error,
      status: 400,
    });
  }

  let parentUserId: string | null = null;
  if ("parentUserId" in b) {
    const raw = b.parentUserId;
    if (raw === null || raw === "") {
      parentUserId = null;
    } else if (typeof raw === "string") {
      const t = raw.trim();
      if (!t) {
        parentUserId = null;
      } else {
        const check = await validateParentUserIdForInstitute(user.instituteId, t);
        if (!check.ok) {
          return apiError({
            code: "STUDENT_CREATE_BAD_REQUEST",
            message: check.message,
            status: 400,
          });
        }
        parentUserId = t;
      }
    } else {
      return apiError({
        code: "STUDENT_CREATE_BAD_REQUEST",
        message: "parentUserId must be a string, null, or empty.",
        status: 400,
      });
    }
  }

  try {
    const student = await prisma.student.create({
      data: {
        fullName,
        dob,
        gender,
        parentName: parentName || null,
        parentPhone: parentPhone || null,
        emergencyContact: emergencyContact || null,
        status: "ACTIVE",
        instituteId: user.instituteId,
        batchId: batchRow.id,
        parentUserId,
      },
    });

    return NextResponse.json({ ok: true, student }, { status: 201 });
  } catch (e) {
    logError("students.create_failed", logCtx, e);
    return apiError({
      code: "STUDENT_CREATE_FAILED",
      message: "Failed to create student.",
      status: 500,
    });
  }
}

export async function GET(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

  const instituteId = user.instituteId;
  const url = new URL(req.url);
  const filterParam = url.searchParams.get("filter")?.trim().toLowerCase() ?? "";
  const alertParam = url.searchParams.get("alert")?.trim().toUpperCase() ?? "";

  let scope: StudentsListScope = { kind: "institute", instituteId };
  if (user.role === ROLE_HEAD_COACH) {
    scope = { kind: "head_coach", branchId: user.branchId ?? null, instituteId };
    if (branchScopeAuditEnabled()) {
      try {
        logHeadCoachBranchAudit({
          source: "api/students",
          phase: "request",
          userId: user.id,
          role: user.role,
          instituteId,
          branchId: user.branchId,
        });
      } catch {
        /* audit must not affect handler */
      }
    }
  } else if (user.role === ROLE_ASSISTANT_COACH) {
    scope = { kind: "assistant", userId: user.id, instituteId };
    if (branchScopeAuditEnabled()) {
      try {
        const links = await prisma.batchAssistant.findMany({
          where: { userId: user.id, batch: { instituteId } },
          select: { batchId: true },
        });
        const assignedBatchCount = new Set(links.map((l) => l.batchId)).size;
        logAssistantBatchAudit({
          source: "api/students",
          phase: "request",
          userId: user.id,
          instituteId,
          assignedBatchCount,
        });
      } catch (e) {
        logAssistantBatchAudit({
          source: "api/students",
          phase: "audit_error",
          message: String(e),
        });
      }
    }
  }

  try {
    const allInScope = await getStudentsOrderedForScope(scope);
    const totalInScope = allInScope.length;
    let students = allInScope;
    if (alertParam === PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK) {
      const ids = await getStudentIdsWithPendingParentVisibleCoachFeedbackDrafts(instituteId);
      students = allInScope.filter((s) => ids.has(s.id));
    } else if (alertParam === PROGRESS_ALERT_TYPE.LOW_ATTENDANCE) {
      if (user.role === ROLE_HEAD_COACH) {
        const ymd = getIndiaTodayCalendarYmd();
        const ids = await getLowAttendanceAttentionStudentIdsForBranch(
          user.branchId ?? null,
          instituteId,
          ymd,
          { headCoachUserId: user.id },
        );
        students = allInScope.filter((s) => ids.has(s.id));
      } else {
        students = [];
      }
    } else if (filterParam === "needs-attention" && user.role === ROLE_HEAD_COACH) {
      const ymd = getIndiaTodayCalendarYmd();
      const ids = await getAttentionStudentIdsForBranch(
        user.branchId ?? null,
        instituteId,
        ymd,
        { headCoachUserId: user.id },
      );
      students = allInScope.filter((s) => ids.has(s.id));
    }

    if (branchScopeAuditEnabled() && user.role === ROLE_HEAD_COACH) {
      try {
        logStudentBatchBranchAudit({
          source: "api/students",
          phase: "after_query",
          userId: user.id,
          instituteId,
          headCoachBranchId: user.branchId,
          scopeStudentCount: allInScope.length,
          responseStudentCount: students.length,
          alertParam: alertParam || null,
          filterParam: filterParam || null,
        });
        if (allInScope.length === 0) {
          const [consistency, emptyScopeExtra] = await Promise.all([
            getBranchScopeConsistencyCounts(instituteId, user.branchId),
            getHeadCoachEmptyScopeExtraStats(instituteId, user.branchId),
          ]);
          logHeadCoachBranchAudit({
            source: "api/students",
            phase: "empty_scope_followup",
            userId: user.id,
            instituteId,
            headCoachBranchId: user.branchId,
            consistency,
            emptyScopeExtra,
          });
        }
      } catch (e) {
        logHeadCoachBranchAudit({
          source: "api/students",
          phase: "audit_error",
          message: String(e),
        });
      }
    }

    if (process.env.HEAD_COACH_SCOPE_DEBUG === "1" && user.role === ROLE_HEAD_COACH) {
      try {
        const matchedBatches = await countMatchedActiveBatchesHeadCoach(
          user.branchId ?? null,
          instituteId,
        );
        const matchedStudents = allInScope.length;
        const audit = await runHeadCoachScopeAudit(instituteId, user.branchId ?? null, user.id);
        const payload: Record<string, unknown> = {
          source: "api/students",
          userId: user.id,
          role: ROLE_HEAD_COACH,
          instituteId,
          sessionBranchId: audit.sessionBranchId,
          dbBranchId: audit.dbBranchId,
          matchedBatches,
          matchedStudents,
          responseStudentCount: students.length,
          instituteBatchCount: audit.counts.instituteBatchCount,
          branchBatchCount: audit.counts.branchBatchCount,
          nullBranchBatchCount: audit.counts.nullBranchBatchCount,
          instituteStudentCount: audit.counts.instituteStudentCount,
          branchStudentCount: audit.counts.branchStudentCount,
          nullBranchStudentCount: audit.counts.nullBranchStudentCount,
          alertParam: alertParam || null,
          filterParam: filterParam || null,
        };
        if (matchedBatches === 0 || matchedStudents === 0) {
          payload.sessionMatchesDb = audit.sessionMatchesDb;
          payload.instituteHasBatchesButNoneForBranch =
            audit.instituteHasBatchesButNoneForBranch;
          payload.nullBranchBatchesCauseExclusion = audit.nullBranchBatchesCauseExclusion;
        }
        debugLogHeadCoachScope(payload);
      } catch {
        /* diagnostics only */
      }
    }

    const rows = students.map((s) => {
      const raw = { ...s } as Record<string, unknown>;
      return studentPayloadForRole(raw, user.role);
    });
    return NextResponse.json({ ok: true, students: rows, totalInScope }, { status: 200 });
  } catch (e) {
    logError("students.list_failed", logCtx, e);
    return apiError({
      code: "STUDENTS_LIST_FAILED",
      message: "Failed to fetch students.",
      status: 500,
    });
  }
}
