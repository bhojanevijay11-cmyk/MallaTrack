import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import { baseCtxFromRequest, logError, logInfo, logCtxWithActor } from "@/lib/server-log";
import { ROLE_ADMIN } from "@/lib/roles";

export const runtime = "nodejs";

const ROUTE = "/api/branches/[id]";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id?.trim()) {
    return apiError({
      code: "BRANCH_ID_REQUIRED",
      message: "Branch id is required.",
      status: 400,
    });
  }

  const userRaw = await getSessionUser();
  const user = await requireRoleWithInstitute(userRaw, [ROLE_ADMIN]);
  if (user instanceof NextResponse) return user;

  const logCtx = baseCtxFromRequest(req, ROUTE);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }

  if (!body || typeof body !== "object") {
    return apiError({
      code: "BRANCH_UPDATE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }

  const rawName = (body as Record<string, unknown>).name;
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) {
    return apiError({
      code: "BRANCH_UPDATE_BAD_REQUEST",
      message: "Branch location / center name is required.",
      status: 400,
    });
  }

  const existing = await prisma.branch.findFirst({
    where: { id: id.trim(), instituteId: user.instituteId },
    select: { id: true },
  });
  if (!existing) {
    return apiError({ code: "BRANCH_NOT_FOUND", message: "Branch not found.", status: 404 });
  }

  const duplicate = await prisma.branch.findFirst({
    where: {
      instituteId: user.instituteId,
      name,
      NOT: { id: id.trim() },
    },
    select: { id: true },
  });
  if (duplicate) {
    return apiError({
      code: "BRANCH_UPDATE_CONFLICT",
      message: "A branch with this name already exists.",
      status: 409,
    });
  }

  try {
    const updated = await prisma.branch.update({
      where: { id: id.trim() },
      data: { name },
      select: { id: true, name: true, createdAt: true },
    });
    return NextResponse.json({
      ok: true,
      branch: {
        id: updated.id,
        name: updated.name,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (e) {
    logError("branches.update_failed", logCtx, e, {
      instituteId: user.instituteId,
      branchId: id.trim(),
    });
    return apiError({
      code: "BRANCH_UPDATE_FAILED",
      message: prismaErrorUserMessage(e, "Could not update branch."),
      status: 400,
    });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id?.trim()) {
    return apiError({
      code: "BRANCH_ID_REQUIRED",
      message: "Branch id is required.",
      status: 400,
    });
  }

  const userRaw = await getSessionUser();
  const user = await requireRoleWithInstitute(userRaw, [ROLE_ADMIN]);
  if (user instanceof NextResponse) return user;

  const logCtx = logCtxWithActor(req, ROUTE, {
    userId: user.id,
    instituteId: user.instituteId,
    role: user.role,
  });

  const branchId = id.trim();

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, instituteId: user.instituteId },
    include: {
      _count: {
        select: { batches: true, users: true },
      },
    },
  });

  if (!branch) {
    return apiError({ code: "BRANCH_NOT_FOUND", message: "Branch not found.", status: 404 });
  }

  if (branch._count.batches > 0) {
    return apiError({
      code: "BRANCH_HAS_BATCHES",
      message:
        "This branch cannot be deleted because it still has batches. Remove or reassign those batches first.",
      status: 409,
    });
  }

  if (branch._count.users > 0) {
    return apiError({
      code: "BRANCH_HAS_STAFF",
      message:
        "This branch cannot be deleted because staff accounts are still assigned to it. Reassign those users first.",
      status: 409,
    });
  }

  const pendingInvites = await prisma.invite.count({
    where: {
      instituteId: user.instituteId,
      branchId,
      usedAt: null,
    },
  });
  if (pendingInvites > 0) {
    return apiError({
      code: "BRANCH_HAS_PENDING_INVITES",
      message:
        "This branch cannot be deleted because it has pending staff invites. Cancel or wait until those invites are used.",
      status: 409,
    });
  }

  try {
    await prisma.branch.delete({ where: { id: branchId } });
    logInfo("branches.deleted", logCtx, {
      branchId,
      branchName: branch.name,
      operation: "DELETE",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError("branches.delete_failed", logCtx, e, { branchId });
    return apiError({
      code: "BRANCH_DELETE_FAILED",
      message: prismaErrorUserMessage(e, "Could not delete branch."),
      status: 400,
    });
  }
}
