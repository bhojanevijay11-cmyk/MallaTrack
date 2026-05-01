import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { prisma } from "@/lib/prisma";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import { canAccessBatch } from "@/lib/scope";
import { baseCtxFromRequest, logCtxWithActor, logError, logInfo } from "@/lib/server-log";
import { staffUserLabel } from "@/lib/staff-user-label";
import { APP_ADMIN_HEAD_ROLES, ROLE_ASSISTANT_COACH } from "@/lib/roles";
import { assertBatchHasBranchId } from "@/lib/write-scope-validation";

export const runtime = "nodejs";

const ROUTE = "/api/batches/[id]/assistants";

const userStaffSelect = {
  id: true,
  email: true,
  invitesReceived: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { fullName: true },
  },
} satisfies Prisma.UserSelect;

async function loadAssignmentLists(batchId: string, instituteId: string) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, instituteId },
    select: { id: true, branchId: true },
  });
  if (!batch) return null;

  const assignedRows = await prisma.batchAssistant.findMany({
    where: { batchId },
    include: { user: { select: userStaffSelect } },
    orderBy: { id: "asc" },
  });
  const assignedIds = assignedRows.map((r) => r.userId);

  const candidateWhere: Prisma.UserWhereInput = {
    instituteId,
    role: ROLE_ASSISTANT_COACH,
  };
  if (assignedIds.length > 0) {
    candidateWhere.id = { notIn: assignedIds };
  }
  if (batch.branchId) {
    candidateWhere.branchId = batch.branchId;
  }

  const candidates = await prisma.user.findMany({
    where: candidateWhere,
    select: userStaffSelect,
    orderBy: { email: "asc" },
  });

  return {
    assigned: assignedRows.map((r) => ({
      userId: r.user.id,
      label: staffUserLabel(r.user),
    })),
    candidates: candidates.map((u) => ({
      userId: u.id,
      label: staffUserLabel(u),
    })),
  };
}

async function validateAssignableAssistant(
  batchId: string,
  instituteId: string,
  userId: string,
): Promise<NextResponse | null> {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, instituteId },
    select: { branchId: true },
  });
  if (!batch) {
    return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
  }

  const branchOk = assertBatchHasBranchId(batch.branchId);
  if (!branchOk.ok) {
    return apiError({
      code: "BATCH_ASSISTANT_ASSIGN_BAD_REQUEST",
      message: branchOk.error,
      status: 400,
    });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, instituteId, role: ROLE_ASSISTANT_COACH },
    select: { id: true, branchId: true },
  });
  if (!target) {
    return apiError({
      code: "BATCH_ASSISTANT_ASSIGN_BAD_REQUEST",
      message: "Only assistant coach accounts in your institute can be assigned.",
      status: 400,
    });
  }

  if (batch.branchId && target.branchId !== batch.branchId) {
    return apiError({
      code: "BATCH_ASSISTANT_ASSIGN_BAD_REQUEST",
      message: "This assistant belongs to a different branch than the batch.",
      status: 400,
    });
  }

  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: batchId } = await params;
  if (!batchId) {
    return apiError({ code: "BATCH_ID_REQUIRED", message: "Batch id is required.", status: 400 });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_ADMIN_HEAD_ROLES);
  if (user instanceof NextResponse) return user;

  const allowed = await canAccessBatch(user, batchId);
  if (!allowed) {
    return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
  }

  const lists = await loadAssignmentLists(batchId, user.instituteId);
  if (!lists) {
    return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
  }

  return NextResponse.json({ ok: true, ...lists }, { status: 200 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id: batchId } = await params;
  if (!batchId) {
    return apiError({ code: "BATCH_ID_REQUIRED", message: "Batch id is required.", status: 400 });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_ADMIN_HEAD_ROLES);
  if (user instanceof NextResponse) return user;

  const allowed = await canAccessBatch(user, batchId);
  if (!allowed) {
    return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({
      code: "BATCH_ASSISTANT_ASSIGN_BAD_REQUEST",
      message: "Invalid JSON body.",
      status: 400,
    });
  }
  if (!body || typeof body !== "object") {
    return apiError({
      code: "BATCH_ASSISTANT_ASSIGN_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }
  const b = body as Record<string, unknown>;
  const rawUserId = b.userId;
  const userId = typeof rawUserId === "string" ? rawUserId.trim() : "";
  if (!userId) {
    return apiError({
      code: "BATCH_ASSISTANT_ASSIGN_BAD_REQUEST",
      message: "userId is required.",
      status: 400,
    });
  }

  const invalid = await validateAssignableAssistant(batchId, user.instituteId, userId);
  if (invalid) return invalid;

  const existing = await prisma.batchAssistant.findUnique({
    where: { batchId_userId: { batchId, userId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyAssigned: true }, { status: 200 });
  }

  try {
    await prisma.batchAssistant.create({
      data: { batchId, userId },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    logError("batches.assistants.assign_failed", logCtx, e, { batchId });
    return apiError({
      code: "BATCH_ASSISTANT_ASSIGN_FAILED",
      message: prismaErrorUserMessage(e, "Could not assign assistant."),
      status: 400,
    });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: batchId } = await params;
  if (!batchId) {
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

  const allowed = await canAccessBatch(user, batchId);
  if (!allowed) {
    return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return apiError({
      code: "BATCH_ASSISTANT_REMOVE_BAD_REQUEST",
      message: "userId query parameter is required.",
      status: 400,
    });
  }

  const row = await prisma.batchAssistant.findFirst({
    where: {
      batchId,
      userId,
      batch: { instituteId: user.instituteId },
    },
    select: { id: true },
  });
  if (!row) {
    return apiError({
      code: "BATCH_ASSISTANT_ASSIGNMENT_NOT_FOUND",
      message:
        "This assistant is not assigned to this batch. The assignment may have already been removed—refresh the page to confirm.",
      status: 404,
    });
  }

  try {
    await prisma.batchAssistant.delete({ where: { id: row.id } });
    logInfo("batches.assistant_removed", actorCtx, {
      batchId,
      assistantUserId: userId,
      operation: "DELETE_ASSISTANT",
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    logError("batches.assistants.remove_failed", actorCtx, e, { batchId, assistantUserId: userId });
    return apiError({
      code: "BATCH_ASSISTANT_REMOVE_FAILED",
      message: prismaErrorUserMessage(e, "Could not remove this assistant from the batch."),
      status: 500,
    });
  }
}
