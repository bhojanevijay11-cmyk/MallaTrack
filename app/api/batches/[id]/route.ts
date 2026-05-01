import { NextResponse } from "next/server";
import {
  getBatchByIdWithStudentsForUser,
  parseBatchStatusStrict,
  toBatchApiRecordWithHeadCoach,
  updateBatchCoach,
  updateBatchFields,
  updateBatchStatus,
  type BatchStatusValue,
} from "@/lib/batches-queries";
import {
  logBatchBranchChange,
  validateBatchBranchChangeForAdmin,
} from "@/lib/batch-branch-assignment";
import { validateBatchTimePair } from "@/lib/batch-time";
import { apiError } from "@/lib/api-response";
import { forbiddenJson, requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { buildBatchScopeWhere } from "@/lib/authz-prisma-scopes";
import { prisma } from "@/lib/prisma";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import { baseCtxFromRequest, logCtxWithActor, logError, logInfo } from "@/lib/server-log";
import {
  APP_ADMIN_HEAD_ROLES,
  APP_STAFF_ROLES,
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
} from "@/lib/roles";

export const runtime = "nodejs";

const ROUTE = "/api/batches/[id]";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id } = await params;

  if (!id) {
    return apiError({ code: "BATCH_ID_REQUIRED", message: "Batch id is required.", status: 400 });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

  try {
    const batch = await getBatchByIdWithStudentsForUser(user, id);
    if (!batch) {
      return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
    }
    const batchRecord = await toBatchApiRecordWithHeadCoach(batch);
    return NextResponse.json(
      {
        ok: true,
        batch: {
          ...batchRecord,
          students: batch.students,
        },
      },
      { status: 200 },
    );
  } catch (e) {
    logError("batches.detail.get_failed", logCtx, e, { batchId: id });
    return apiError({
      code: "BATCH_GET_FAILED",
      message: "Failed to fetch batch.",
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

  if (!id) {
    return apiError({ code: "BATCH_ID_REQUIRED", message: "Batch id is required.", status: 400 });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;
  if (user.role === ROLE_ASSISTANT_COACH) {
    return forbiddenJson("Assistant coaches cannot modify batches.");
  }

  const batchScope = await buildBatchScopeWhere(user);
  const inScope = await prisma.batch.findFirst({
    where: { AND: [batchScope, { id }] },
    select: { id: true },
  });
  if (!inScope) {
    return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BATCH_UPDATE_BAD_REQUEST", message: "Invalid JSON body.", status: 400 });
  }

  if (!body || typeof body !== "object") {
    return apiError({
      code: "BATCH_UPDATE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }

  const b = body as Record<string, unknown>;
  const hasName = "name" in b;
  const hasStatus = "status" in b;
  const hasStart = "startTime" in b;
  const hasEnd = "endTime" in b;
  const hasCoachId = "coachId" in b;
  const hasBranchId = "branchId" in b;
  const hasMetadataFields = hasName || hasStatus || hasStart || hasEnd;

  if (hasBranchId && user.role !== ROLE_ADMIN) {
    return forbiddenJson("Only institute admins can assign or change batch branch.");
  }

  if (hasMetadataFields && user.role !== ROLE_ADMIN) {
    return forbiddenJson("Only institute admins can change batch name, schedule, or status.");
  }

  if (!hasName && !hasStatus && !hasStart && !hasEnd && !hasCoachId && !hasBranchId) {
    return apiError({
      code: "BATCH_UPDATE_BAD_REQUEST",
      message:
        "No fields to update (name, status, startTime, endTime, coachId, branchId).",
      status: 400,
    });
  }

  if (hasCoachId && (hasName || hasStatus || hasStart || hasEnd || hasBranchId)) {
    return apiError({
      code: "BATCH_UPDATE_BAD_REQUEST",
      message:
        "Assign or remove the Head Coach in a separate request (coachId only, with no other batch fields).",
      status: 400,
    });
  }

  try {
    if (hasCoachId) {
      const raw = b.coachId;
      const nextCoachId: string | null =
        raw === null || raw === undefined
          ? null
          : typeof raw === "string"
            ? raw.trim() || null
            : null;
      if (raw !== null && raw !== undefined && typeof raw !== "string") {
        return apiError({
          code: "BATCH_UPDATE_BAD_REQUEST",
          message: "coachId must be a string or null.",
          status: 400,
        });
      }

      const updated = await updateBatchCoach(id, nextCoachId, user.instituteId);
      if (!updated) {
        return apiError({
          code: "BATCH_NOT_FOUND",
          message: "Batch not found, or coach id is invalid.",
          status: 404,
        });
      }
      const batchRecord = await toBatchApiRecordWithHeadCoach(updated);
      return NextResponse.json({ ok: true, batch: batchRecord }, { status: 200 });
    }

    const existing = await prisma.batch.findFirst({
      where: { AND: [batchScope, { id }] },
    });
    if (!existing) {
      return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
    }

    let branchChangeLog: {
      oldBranchId: string | null;
      newBranchId: string | null;
    } | null = null;
    let branchIdForUpdate: string | null | undefined = undefined;

    if (hasBranchId) {
      const rawBr = b.branchId;
      if (rawBr !== null && rawBr !== undefined && typeof rawBr !== "string") {
        return apiError({
          code: "BATCH_UPDATE_BAD_REQUEST",
          message: "branchId must be a string, null, or omitted.",
          status: 400,
        });
      }
      const nextBr = rawBr === null || rawBr === undefined ? null : rawBr.trim() || null;
      const branchCheck = await validateBatchBranchChangeForAdmin(id, user.instituteId, nextBr);
      if (!branchCheck.ok) {
        const branchErrCode =
          branchCheck.status === 404
            ? "BATCH_NOT_FOUND"
            : branchCheck.status === 409
              ? "BATCH_UPDATE_BRANCH_CONFLICT"
              : "BATCH_UPDATE_BAD_REQUEST";
        return apiError({
          code: branchErrCode,
          message: branchCheck.error,
          status: branchCheck.status,
        });
      }
      if (branchCheck.changed) {
        branchIdForUpdate = branchCheck.newBranchId;
        branchChangeLog = {
          oldBranchId: branchCheck.oldBranchId,
          newBranchId: branchCheck.newBranchId,
        };
      }
    }

    let nextName: string | null = existing.name;
    if (hasName) {
      const n = typeof b.name === "string" ? b.name.trim() : "";
      if (!n) {
        return apiError({
          code: "BATCH_UPDATE_BAD_REQUEST",
          message: "Batch name cannot be empty.",
          status: 400,
        });
      }
      nextName = n;
    }

    let nextStatus: BatchStatusValue =
      (existing.status ?? "").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    if (hasStatus) {
      const st = parseBatchStatusStrict(b.status);
      if (!st) {
        return apiError({
          code: "BATCH_UPDATE_BAD_REQUEST",
          message: "status must be ACTIVE or INACTIVE.",
          status: 400,
        });
      }
      nextStatus = st;
    }

    const onlyStatusToggle = hasStatus && !hasName && !hasStart && !hasEnd && !hasBranchId;
    if (onlyStatusToggle) {
      const batch = await updateBatchStatus(id, nextStatus);
      const batchRecord = await toBatchApiRecordWithHeadCoach(batch);
      return NextResponse.json({ ok: true, batch: batchRecord }, { status: 200 });
    }

    const mergedStart = hasStart ? b.startTime : existing.startTime;
    const mergedEnd = hasEnd ? b.endTime : existing.endTime;
    const times = validateBatchTimePair(mergedStart, mergedEnd);
    if (!times.ok) {
      return apiError({ code: "BATCH_UPDATE_BAD_REQUEST", message: times.error, status: 400 });
    }

    const batch = await updateBatchFields(id, {
      name: nextName,
      status: nextStatus,
      startTime: times.startTime,
      endTime: times.endTime,
      ...(branchIdForUpdate !== undefined ? { branchId: branchIdForUpdate } : {}),
    });

    if (branchChangeLog) {
      logBatchBranchChange({
        actorUserId: user.id,
        batchId: id,
        oldBranchId: branchChangeLog.oldBranchId,
        newBranchId: branchChangeLog.newBranchId,
      });
    }

    const batchRecord = await toBatchApiRecordWithHeadCoach(batch);
    return NextResponse.json({ ok: true, batch: batchRecord }, { status: 200 });
  } catch (err) {
    logError("batches.detail.update_failed", logCtx, err, { batchId: id });
    const message = prismaErrorUserMessage(err, "Could not update batch. Please try again.");
    return apiError({ code: "BATCH_UPDATE_FAILED", message, status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id } = await params;

  if (!id) {
    return apiError({ code: "BATCH_ID_REQUIRED", message: "Batch id is required.", status: 400 });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_ADMIN_HEAD_ROLES);
  if (user instanceof NextResponse) return user;

  const actorCtx = logCtxWithActor(req, ROUTE, {
    userId: user.id,
    instituteId: user.instituteId,
    role: user.role,
  });

  const batchScope = await buildBatchScopeWhere(user);
  const batch = await prisma.batch.findFirst({
    where: { AND: [batchScope, { id }] },
    include: {
      _count: {
        select: {
          students: true,
          attendances: true,
          progressAssessments: true,
        },
      },
    },
  });

  if (!batch) {
    return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
  }

  if (batch._count.students > 0) {
    return apiError({
      code: "BATCH_HAS_STUDENTS",
      message:
        "This batch cannot be deleted because students are still assigned to it. Remove students from the batch first.",
      status: 409,
    });
  }

  if (batch._count.attendances > 0) {
    return apiError({
      code: "BATCH_HAS_ATTENDANCE",
      message:
        "This batch cannot be deleted because it has attendance history. Deleting it would remove those records.",
      status: 409,
    });
  }

  if (batch._count.progressAssessments > 0) {
    return apiError({
      code: "BATCH_HAS_PROGRESS",
      message:
        "This batch cannot be deleted because it has progress assessments. Remove or archive those assessments first.",
      status: 409,
    });
  }

  try {
    await prisma.batch.delete({ where: { id } });
    logInfo("batches.deleted", actorCtx, {
      batchId: id,
      batchName: batch.name,
      instituteId: user.instituteId,
      operation: "DELETE",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("batches.detail.delete_failed", actorCtx, err, { batchId: id });
    const message = prismaErrorUserMessage(err, "Could not delete batch. Please try again.");
    return apiError({ code: "BATCH_DELETE_FAILED", message, status: 500 });
  }
}
