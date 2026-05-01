import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { baseCtxFromRequest, logError } from "@/lib/server-log";
import {
  assertProgressAssessmentAccess,
} from "@/lib/authz-assertions";
import { canAccessBatch } from "@/lib/scope";
import {
  parseProgressAssessmentIndicator,
  parseProgressPeriodType,
  PROGRESS_ASSESSMENT_STATUS,
} from "@/lib/progress-assessment-constants";
import { parseAssessmentDateInput } from "@/lib/progress-assessment-datetime";
import {
  progressAssessmentDetailInclude,
  progressAssessmentListSelect,
  serializeProgressAssessmentDetail,
  serializeProgressAssessmentListRow,
} from "@/lib/progress-assessment-payload";
import {
  parseAssessmentExercisesInput,
  type ParsedAssessmentExercise,
} from "@/lib/progress-assessment-exercises-parse";
import { computeOverallScoreFromCategories } from "@/lib/progress-assessment-category-scores";
import { assertHeadCoachAssessmentTargetBranch } from "@/lib/progress-assessment-target-scope";
import { assertBatchHasBranchId } from "@/lib/write-scope-validation";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";

export const runtime = "nodejs";

const ROUTE = "/api/progress/assessments/[id]";

const READ_ROLES = [ROLE_ADMIN, ROLE_HEAD_COACH, ROLE_ASSISTANT_COACH] as const;

const PATCH_FORBIDDEN_KEYS = new Set([
  "instituteId",
  "studentId",
  "authorUserId",
  "status",
  "submittedAt",
  "submittedByUserId",
  "reviewedAt",
  "reviewedByUserId",
  "reviewNote",
]);

function notFound() {
  return apiError({ code: "ASSESSMENT_NOT_FOUND", message: "Not found.", status: 404 });
}

function clampScore(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 1 || r > 10) return null;
  return r;
}

function parsePatchScore(
  v: unknown,
): { ok: true; value: number | null | undefined } | { ok: false } {
  if (v === undefined) return { ok: true, value: undefined };
  if (v === null) return { ok: true, value: null };
  const c = clampScore(v);
  if (c === null) return { ok: false };
  return { ok: true, value: c };
}

async function loadVisibleAssessment(id: string, user: SessionUserWithInstitute) {
  const row = await prisma.progressAssessment.findUnique({
    where: { id },
    include: progressAssessmentDetailInclude,
  });
  if (!row) return notFound();
  const denied = await assertProgressAssessmentAccess(user, row);
  if (denied) return denied;
  return row;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id } = await params;
  if (!id) return notFound();

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, READ_ROLES);
  if (user instanceof NextResponse) return user;

  try {
    const loaded = await loadVisibleAssessment(id, user);
    if (loaded instanceof NextResponse) return loaded;

    return NextResponse.json({ ok: true, assessment: serializeProgressAssessmentDetail(loaded) });
  } catch (e) {
    logError("progress.assessments.detail_get_failed", logCtx, e, { assessmentId: id });
    return apiError({
      code: "ASSESSMENT_GET_FAILED",
      message: prismaErrorUserMessage(e, "Could not load this assessment."),
      status: 500,
    });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id } = await params;
  if (!id) return notFound();

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, READ_ROLES);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return apiError({
      code: "ASSESSMENT_UPDATE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }
  const b = body as Record<string, unknown>;

  for (const k of PATCH_FORBIDDEN_KEYS) {
    if (k in b) {
      return apiError({
        code: "ASSESSMENT_UPDATE_BAD_REQUEST",
        message: `Field "${k}" cannot be updated here.`,
        status: 400,
      });
    }
  }

  const existing = await prisma.progressAssessment.findUnique({
    where: { id },
    select: {
      id: true,
      instituteId: true,
      studentId: true,
      batchId: true,
      status: true,
      authorUserId: true,
      strengthScore: true,
      flexibilityScore: true,
      techniqueScore: true,
      disciplineScore: true,
    },
  });
  if (!existing) return notFound();
  const deniedExisting = await assertProgressAssessmentAccess(user, existing);
  if (deniedExisting) return deniedExisting;

  if (existing.authorUserId !== user.id) {
    return apiError({
      code: "ASSESSMENT_UPDATE_FORBIDDEN",
      message: "Only the author can edit this assessment.",
      status: 403,
    });
  }

  if (
    existing.status !== PROGRESS_ASSESSMENT_STATUS.DRAFT &&
    existing.status !== PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION
  ) {
    return apiError({
      code: "ASSESSMENT_UPDATE_CONFLICT",
      message: "Assessment cannot be edited in its current status.",
      status: 409,
    });
  }

  const data: Prisma.ProgressAssessmentUncheckedUpdateInput = {};

  if ("assessmentDate" in b) {
    const d = parseAssessmentDateInput(b.assessmentDate);
    if (!d) {
      return apiError({
        code: "ASSESSMENT_UPDATE_BAD_REQUEST",
        message: "Invalid assessmentDate (YYYY-MM-DD or ISO date).",
        status: 400,
      });
    }
    data.assessmentDate = d;
  }

  if ("periodType" in b) {
    const p = parseProgressPeriodType(b.periodType);
    if (!p) {
      return apiError({
        code: "ASSESSMENT_UPDATE_BAD_REQUEST",
        message: "Invalid periodType.",
        status: 400,
      });
    }
    data.periodType = p;
  }

  if ("periodKey" in b) {
    if (b.periodKey === null) {
      data.periodKey = null;
    } else if (typeof b.periodKey === "string") {
      const t = b.periodKey.trim().slice(0, 200);
      data.periodKey = t === "" ? null : t;
    } else {
      return apiError({
        code: "ASSESSMENT_UPDATE_BAD_REQUEST",
        message: "Invalid periodKey.",
        status: 400,
      });
    }
  }

  const scoreFields = [
    "strengthScore",
    "flexibilityScore",
    "techniqueScore",
    "disciplineScore",
    "overallScore",
  ] as const;
  for (const key of scoreFields) {
    if (key in b) {
      const r = parsePatchScore(b[key]);
      if (!r.ok) {
        return apiError({
          code: "ASSESSMENT_UPDATE_BAD_REQUEST",
          message: `Invalid ${key}.`,
          status: 400,
        });
      }
      if (r.value !== undefined) data[key] = r.value;
    }
  }

  const anyScoreFieldInBody = scoreFields.some((k) => k in b);
  if (anyScoreFieldInBody) {
    const mergedStrength =
      "strengthScore" in data ? (data.strengthScore as number | null) : existing.strengthScore;
    const mergedFlexibility =
      "flexibilityScore" in data ? (data.flexibilityScore as number | null) : existing.flexibilityScore;
    const mergedTechnique =
      "techniqueScore" in data ? (data.techniqueScore as number | null) : existing.techniqueScore;
    const mergedDiscipline =
      "disciplineScore" in data ? (data.disciplineScore as number | null) : existing.disciplineScore;
    data.overallScore = computeOverallScoreFromCategories(
      mergedStrength,
      mergedFlexibility,
      mergedTechnique,
      mergedDiscipline,
    );
  }

  if ("coachNotes" in b) {
    if (b.coachNotes === null) {
      data.coachNotes = null;
    } else if (typeof b.coachNotes === "string") {
      data.coachNotes = b.coachNotes.trim().slice(0, 4000) || null;
    } else {
      return apiError({
        code: "ASSESSMENT_UPDATE_BAD_REQUEST",
        message: "Invalid coachNotes.",
        status: 400,
      });
    }
  }

  if ("assessmentIndicator" in b) {
    if (b.assessmentIndicator === null) {
      data.assessmentIndicator = null;
    } else {
      const p = parseProgressAssessmentIndicator(b.assessmentIndicator);
      const nonEmpty =
        typeof b.assessmentIndicator === "string" && b.assessmentIndicator.trim() !== "";
      if (nonEmpty && !p) {
        return apiError({
          code: "ASSESSMENT_UPDATE_BAD_REQUEST",
          message: "Invalid assessmentIndicator.",
          status: 400,
        });
      }
      data.assessmentIndicator = p;
    }
  }

  if ("batchId" in b) {
    if (typeof b.batchId !== "string") {
      return apiError({
        code: "ASSESSMENT_UPDATE_BAD_REQUEST",
        message: "Invalid batchId.",
        status: 400,
      });
    }
    const newBatchId = b.batchId.trim();
    if (!newBatchId) {
      return apiError({
        code: "ASSESSMENT_UPDATE_BAD_REQUEST",
        message: "Invalid batchId.",
        status: 400,
      });
    }
    const batchOk = await canAccessBatch(user, newBatchId);
    if (!batchOk) {
      return apiError({
        code: "ASSESSMENT_UPDATE_FORBIDDEN",
        message: "You cannot assign this batch.",
        status: 403,
      });
    }
    const student = await prisma.student.findUnique({
      where: { id: existing.studentId },
      select: { batchId: true, instituteId: true },
    });
    if (!student || student.instituteId !== user.instituteId) {
      return notFound();
    }
    if (student.batchId !== newBatchId) {
      return apiError({
        code: "ASSESSMENT_UPDATE_BAD_REQUEST",
        message: "batchId must match the student's current batch.",
        status: 400,
      });
    }
    const batch = await prisma.batch.findUnique({
      where: { id: newBatchId },
      select: { instituteId: true, branchId: true },
    });
    if (!batch || batch.instituteId !== user.instituteId) {
      return apiError({ code: "ASSESSMENT_BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
    }
    const branchGate = assertBatchHasBranchId(batch.branchId);
    if (!branchGate.ok) {
      return apiError({
        code: "ASSESSMENT_UPDATE_BAD_REQUEST",
        message: branchGate.error,
        status: 400,
      });
    }
    const deniedBranchMove = await assertHeadCoachAssessmentTargetBranch(
      user,
      existing.studentId,
      newBatchId,
    );
    if (deniedBranchMove) return deniedBranchMove;
    data.batchId = newBatchId;
  }

  let exerciseRows: ParsedAssessmentExercise[] | null = null;
  if ("exercises" in b) {
    const parsed = parseAssessmentExercisesInput(b.exercises);
    if (parsed instanceof NextResponse) return parsed;
    exerciseRows = parsed;
  }
  const hasExerciseUpdates = exerciseRows !== null;

  const hasScalarUpdates = Object.keys(data).length > 0;
  if (!hasScalarUpdates && !hasExerciseUpdates) {
    return apiError({
      code: "ASSESSMENT_UPDATE_BAD_REQUEST",
      message: "No valid fields to update.",
      status: 400,
    });
  }

  try {
    if (hasExerciseUpdates) {
      const rows = exerciseRows ?? [];
      await prisma.$transaction(async (tx) => {
        await tx.progressAssessmentExercise.deleteMany({ where: { assessmentId: id } });
        if (rows.length > 0) {
          await tx.progressAssessmentExercise.createMany({
            data: rows.map((ex, i) => ({
              assessmentId: id,
              exerciseName: ex.exerciseName,
              expectedPerformance: ex.expectedPerformance,
              observedPerformance: ex.observedPerformance,
              note: ex.note,
              targetReps: ex.targetReps,
              targetSets: ex.targetSets,
              completedReps: ex.completedReps,
              completedSets: ex.completedSets,
              sortOrder: i,
            })),
          });
        }
        if (hasScalarUpdates) {
          await tx.progressAssessment.update({ where: { id }, data });
        } else {
          await tx.progressAssessment.update({
            where: { id },
            data: { updatedAt: new Date() },
          });
        }
      });
    } else {
      await prisma.progressAssessment.update({
        where: { id },
        data,
        select: progressAssessmentListSelect,
      });
    }

    const row = await prisma.progressAssessment.findUnique({
      where: { id },
      select: progressAssessmentListSelect,
    });
    if (!row) return notFound();

    return NextResponse.json({ ok: true, assessment: serializeProgressAssessmentListRow(row) });
  } catch (e) {
    logError("progress.assessments.update_failed", logCtx, e, { assessmentId: id });
    return apiError({
      code: "ASSESSMENT_UPDATE_FAILED",
      message: prismaErrorUserMessage(e, "Could not save changes to this assessment."),
      status: 500,
    });
  }
}
