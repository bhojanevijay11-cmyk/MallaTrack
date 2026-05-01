import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import { ROLE_PARENT } from "@/lib/roles";
import { hashInviteToken } from "@/lib/invites";
import { baseCtxFromRequest, logError } from "@/lib/server-log";
import { validatePassword } from "@/lib/user-validation";

export const runtime = "nodejs";

const ROUTE = "/api/parent/accept-invite";

const INVALID_LINK = "This invite link is invalid or has expired.";

function parseBody(
  body: unknown,
): { ok: true; token: string; password: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid request body." };
  const b = body as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!token) return { ok: false, error: "Missing invite token." };
  const pw = validatePassword(password);
  if (!pw.ok) return { ok: false, error: pw.message };
  return { ok: true, token, password };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed.ok) {
    return apiError({
      code: "PARENT_INVITE_ACCEPT_BAD_REQUEST",
      message: parsed.error,
      status: 400,
    });
  }

  const logCtx = baseCtxFromRequest(req, ROUTE);

  const tokenHash = hashInviteToken(parsed.token);
  const now = new Date();

  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      email: true,
      instituteId: true,
      invitedUserId: true,
      studentId: true,
      role: true,
    },
  });

  if (!invite || !invite.studentId || invite.role !== ROLE_PARENT) {
    return apiError({
      code: "PARENT_INVITE_ACCEPT_NOT_FOUND",
      message: INVALID_LINK,
      status: 404,
    });
  }
  if (invite.usedAt) {
    return apiError({
      code: "INVITE_ACCEPT_USED",
      message: "This invite link has already been used.",
      status: 409,
    });
  }
  if (invite.expiresAt <= now) {
    return apiError({
      code: "INVITE_ACCEPT_EXPIRED",
      message: "This invite link has expired.",
      status: 410,
    });
  }

  const student = await prisma.student.findFirst({
    where: { id: invite.studentId, instituteId: invite.instituteId },
    select: { id: true, parentUserId: true },
  });
  if (!student || student.parentUserId !== invite.invitedUserId) {
    return apiError({
      code: "PARENT_INVITE_ACCEPT_NOT_FOUND",
      message: INVALID_LINK,
      status: 404,
    });
  }

  const userRow = await prisma.user.findUnique({
    where: { id: invite.invitedUserId },
    select: { id: true, email: true, instituteId: true },
  });
  if (!userRow || userRow.email !== invite.email) {
    return apiError({
      code: "PARENT_INVITE_ACCEPT_NOT_FOUND",
      message: INVALID_LINK,
      status: 404,
    });
  }
  if (userRow.instituteId && userRow.instituteId !== invite.instituteId) {
    return apiError({
      code: "PARENT_INVITE_ACCEPT_NOT_FOUND",
      message: INVALID_LINK,
      status: 404,
    });
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  try {
    await prisma.$transaction(async (tx) => {
      const reserved = await tx.invite.updateMany({
        where: {
          id: invite.id,
          usedAt: null,
          expiresAt: { gt: now },
          studentId: { not: null },
          role: ROLE_PARENT,
        },
        data: { usedAt: now },
      });
      if (reserved.count === 0) {
        const fresh = await tx.invite.findUnique({
          where: { id: invite.id },
          select: { usedAt: true, expiresAt: true },
        });
        if (fresh?.usedAt) {
          throw Object.assign(new Error("PARENT_INVITE_RACE_USED"), { name: "InviteStaleError" });
        }
        if (fresh && fresh.expiresAt <= now) {
          throw Object.assign(new Error("PARENT_INVITE_RACE_EXPIRED"), { name: "InviteStaleError" });
        }
        throw Object.assign(new Error("PARENT_INVITE_RACE_INVALID"), { name: "InviteStaleError" });
      }
      await tx.user.update({
        where: { id: userRow.id },
        data: {
          passwordHash,
          role: ROLE_PARENT,
          instituteId: invite.instituteId,
          branchId: null,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.name === "InviteStaleError") {
      if (e.message === "PARENT_INVITE_RACE_USED") {
        return apiError({
          code: "INVITE_ACCEPT_USED",
          message:
            "This invite was already used. If you just finished setup, sign in; otherwise ask your institute for a new parent invite.",
          status: 409,
        });
      }
      if (e.message === "PARENT_INVITE_RACE_EXPIRED") {
        return apiError({
          code: "INVITE_ACCEPT_EXPIRED",
          message: "This invite link has expired. Ask your institute to send a new parent invite.",
          status: 410,
        });
      }
      logError("parent.accept_invite_stale", logCtx, e, {
        inviteId: invite.id,
        instituteId: invite.instituteId,
      });
      return apiError({
        code: "PARENT_INVITE_ACCEPT_STALE",
        message:
          "This invite could not be completed because its state changed. Refresh the page or open the link again.",
        status: 409,
      });
    }
    logError("parent.accept_invite_failed", logCtx, e, {
      inviteId: invite.id,
      instituteId: invite.instituteId,
    });
    return apiError({
      code: "PARENT_INVITE_ACCEPT_FAILED",
      message: prismaErrorUserMessage(e, "Could not complete setup. Please try again."),
      status: 500,
    });
  }

  return NextResponse.json({
    ok: true,
    email: invite.email,
    redirectTo: "/parent",
  });
}
