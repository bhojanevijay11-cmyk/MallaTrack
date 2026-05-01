import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { baseCtxFromRequest, logError } from "@/lib/server-log";
import { assertBatchAccess, assertStudentForProgress } from "@/lib/authz-assertions";
import { progressAssessmentScopeWhere } from "@/lib/progress-assessment-access";
import {
  parseProgressAssessmentIndicator,
  parseProgressAssessmentStatus,
  parseProgressPeriodType,
  PROGRESS_PERIOD_TYPE,
} from "@/lib/progress-assessment-constants";
import {
  assessmentDateGteFromYmd,
  assessmentDateLtExclusiveAfterYmd,
  parseAssessmentDateInput,
} from "@/lib/progress-assessment-datetime";
import {
  progressAssessmentListSelect,
  serializeProgressAssessmentListRow,
} from "@/lib/progress-assessment-payload";
import { parseAssessmentExercisesInput } from "@/lib/progress-assessment-exercises-parse";
import { computeOverallScoreFromCategories } from "@/lib/progress-assessment-category-scores";
import { assertHeadCoachAssessmentTargetBranch } from "@/lib/progress-assessment-target-scope";
import {
  progressAssessmentRecordOperationallyVisible,
  type ProgressAssessmentGuardrailRow,
} from "@/lib/tenant-integrity-guardrails";
import { assertBatchHasBranchId } from "@/lib/write-scope-validation";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";
import { findVisibleActiveProgressAssessmentForStudent } from "@/lib/progress-assessment-active";

export const runtime = "nodejs";

const ROUTE = "/api/progress/assessments";

const READ_ROLES = [ROLE_ADMIN, ROLE_HEAD_COACH, ROLE_ASSISTANT_COACH] as const;
const CREATE_ROLES = [ROLE_ADMIN, ROLE_HEAD_COACH, ROLE_ASSISTANT_COACH] as const;

function clampScore(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 1 || r > 10) return null;
  return r;
}

export async function GET(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, READ_ROLES);
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const studentIdParam = url.searchParams.get("studentId")?.trim() ?? "";
  const batchIdParam = url.searchParams.get("batchId")?.trim() ?? "";
  const statusRaw = url.searchParams.get("status")?.trim() ?? "";
  const fromRaw = url.searchParams.get("from")?.trim() ?? "";
  const toRaw = url.searchParams.get("to")?.trim() ?? "";

  const scopeWhere = await progressAssessmentScopeWhere(user);
  const sidIn = scopeWhere.studentId;
  if (
    typeof sidIn === "object" &&
    sidIn !== null &&
    "in" in sidIn &&
    Array.isArray(sidIn.in) &&
    sidIn.in.length === 0
  ) {
    return NextResponse.json({ ok: true, assessments: [] });
  }

  const where: Prisma.ProgressAssessmentWhereInput = { ...scopeWhere };

  if (statusRaw) {
    const st = parseProgressAssessmentStatus(statusRaw);
    if (!st) {
      return apiError({
        code: "ASSESSMENTS_LIST_BAD_REQUEST",
        message: "Invalid status filter.",
        status: 400,
      });
    }
    where.status = st;
  }

  const dateFilter: Prisma.DateTimeFilter = {};
  if (fromRaw) {
    const gte = assessmentDateGteFromYmd(fromRaw);
    if (!gte) {
      return apiError({
        code: "ASSESSMENTS_LIST_BAD_REQUEST",
        message: "Invalid from date (use YYYY-MM-DD).",
        status: 400,
      });
    }
    dateFilter.gte = gte;
  }
  if (toRaw) {
    const lt = assessmentDateLtExclusiveAfterYmd(toRaw);
    if (!lt) {
      return apiError({
        code: "ASSESSMENTS_LIST_BAD_REQUEST",
        message: "Invalid to date (use YYYY-MM-DD).",
        status: 400,
      });
    }
    dateFilter.lt = lt;
  }
  if (Object.keys(dateFilter).length > 0) {
    where.assessmentDate = dateFilter;
  }

  if (studentIdParam) {
    const deniedStudent = await assertStudentForProgress(
      user,
      studentIdParam,
      "You cannot view assessments for this student.",
    );
    if (deniedStudent) return deniedStudent;
    where.studentId = studentIdParam;
  }

  if (batchIdParam) {
    const deniedBatch = await assertBatchAccess(
      user,
      batchIdParam,
      "You cannot view assessments for this batch.",
    );
    if (deniedBatch) return deniedBatch;
    where.batchId = batchIdParam;
  }

  let rows;
  try {
    rows = await prisma.progressAssessment.findMany({
      where,
      orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
      select: progressAssessmentListSelect,
    });
  } catch (e) {
    logError("progress.assessments.list_failed", logCtx, e, { instituteId: user.instituteId });
    throw e;
  }

  const visible = rows.filter((r) =>
    progressAssessmentRecordOperationallyVisible(r as ProgressAssessmentGuardrailRow),
  );

  return NextResponse.json({
    ok: true,
    assessments: visible.map(serializeProgressAssessmentListRow),
  });
}

export async function POST(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, CREATE_ROLES);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return apiError({
      code: "ASSESSMENT_CREATE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }
  const b = body as Record<string, unknown>;

  const studentId = typeof b.studentId === "string" ? b.studentId.trim() : "";
  const batchId = typeof b.batchId === "string" ? b.batchId.trim() : "";
  const assessmentDate = parseAssessmentDateInput(b.assessmentDate);

  let periodType: (typeof PROGRESS_PERIOD_TYPE)[keyof typeof PROGRESS_PERIOD_TYPE] =
    PROGRESS_PERIOD_TYPE.ADHOC;
  if (b.periodType !== undefined && b.periodType !== null && b.periodType !== "") {
    const p = parseProgressPeriodType(b.periodType);
    if (!p) {
      return apiError({
        code: "ASSESSMENT_CREATE_BAD_REQUEST",
        message: "Invalid periodType.",
        status: 400,
      });
    }
    periodType = p;
  }
  const periodKeyRaw = typeof b.periodKey === "string" ? b.periodKey.trim().slice(0, 200) : "";
  const periodKey = periodKeyRaw || null;

  if (!studentId) {
    return apiError({
      code: "ASSESSMENT_CREATE_BAD_REQUEST",
      message: "Missing studentId.",
      status: 400,
    });
  }
  if (!batchId) {
    return apiError({
      code: "ASSESSMENT_CREATE_BAD_REQUEST",
      message: "Missing batchId.",
      status: 400,
    });
  }
  if (!assessmentDate) {
    return apiError({
      code: "ASSESSMENT_CREATE_BAD_REQUEST",
      message: "Missing or invalid assessmentDate (YYYY-MM-DD or ISO date).",
      status: 400,
    });
  }

  const deniedStudent = await assertStudentForProgress(
    user,
    studentId,
    "You cannot create an assessment for this student.",
  );
  if (deniedStudent) return deniedStudent;

  const deniedBatch = await assertBatchAccess(
    user,
    batchId,
    "You cannot create an assessment for this batch.",
  );
  if (deniedBatch) return deniedBatch;

  const deniedBranch = await assertHeadCoachAssessmentTargetBranch(user, studentId, batchId);
  if (deniedBranch) return deniedBranch;

  const existingActive = await findVisibleActiveProgressAssessmentForStudent(user, studentId);
  if (existingActive) {
    const conflictMessage =
      "This student already has an assessment in progress. Open the existing assessment instead of creating another.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ACTIVE_ASSESSMENT_EXISTS",
          message: conflictMessage,
        },
        existingAssessmentId: existingActive.id,
      },
      { status: 409 },
    );
  }

  const exercisesParsed = parseAssessmentExercisesInput(
    "exercises" in b ? (b as Record<string, unknown>).exercises : undefined,
  );
  if (exercisesParsed instanceof NextResponse) return exercisesParsed;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { instituteId: true, batchId: true },
  });
  if (!student || student.instituteId !== user.instituteId) {
    return apiError({
      code: "ASSESSMENT_STUDENT_NOT_FOUND",
      message: "Student not found.",
      status: 404,
    });
  }
  if (student.batchId !== batchId) {
    return apiError({
      code: "ASSESSMENT_CREATE_BAD_REQUEST",
      message: "batchId does not match the student's current batch.",
      status: 400,
    });
  }

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { instituteId: true, branchId: true },
  });
  if (!batch || batch.instituteId !== user.instituteId) {
    return apiError({ code: "ASSESSMENT_BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
  }
  const branchGate = assertBatchHasBranchId(batch.branchId);
  if (!branchGate.ok) {
    return apiError({
      code: "ASSESSMENT_CREATE_BAD_REQUEST",
      message: branchGate.error,
      status: 400,
    });
  }

  const coachNotes =
    typeof b.coachNotes === "string" ? b.coachNotes.trim().slice(0, 4000) : "";
  const coachNotesVal = coachNotes || null;

  let assessmentIndicator: string | null = null;
  if ("assessmentIndicator" in b) {
    if (b.assessmentIndicator === null) {
      assessmentIndicator = null;
    } else {
      const p = parseProgressAssessmentIndicator(b.assessmentIndicator);
      const nonEmpty =
        typeof b.assessmentIndicator === "string" && b.assessmentIndicator.trim() !== "";
      if (nonEmpty && !p) {
        return apiError({
          code: "ASSESSMENT_CREATE_BAD_REQUEST",
          message: "Invalid assessmentIndicator.",
          status: 400,
        });
      }
      assessmentIndicator = p;
    }
  }

  const strengthScore = clampScore(b.strengthScore);
  const flexibilityScore = clampScore(b.flexibilityScore);
  const techniqueScore = clampScore(b.techniqueScore);
  const disciplineScore = clampScore(b.disciplineScore);
  const overallScore = computeOverallScoreFromCategories(
    strengthScore,
    flexibilityScore,
    techniqueScore,
    disciplineScore,
  );

  let row;
  try {
    row = await prisma.progressAssessment.create({
      data: {
        instituteId: user.instituteId,
        studentId,
        batchId,
        assessmentDate,
        periodType,
        periodKey,
        status: "DRAFT",
        strengthScore,
        flexibilityScore,
        techniqueScore,
        disciplineScore,
        overallScore,
        coachNotes: coachNotesVal,
        assessmentIndicator,
        authorUserId: user.id,
        ...(exercisesParsed.length > 0
          ? {
              exercises: {
                create: exercisesParsed.map((ex, i) => ({
                  ...ex,
                  sortOrder: i,
                })),
              },
            }
          : {}),
      },
      select: progressAssessmentListSelect,
    });
  } catch (e) {
    logError("progress.assessments.create_failed", logCtx, e, {
      instituteId: user.instituteId,
      studentId,
    });
    throw e;
  }

  return NextResponse.json(
    { ok: true, assessment: serializeProgressAssessmentListRow(row) },
    { status: 201 },
  );
}
