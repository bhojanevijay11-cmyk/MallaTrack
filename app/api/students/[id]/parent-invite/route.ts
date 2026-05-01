import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { ROLE_ADMIN, ROLE_PARENT } from "@/lib/roles";
import { generateInviteToken, hashInviteToken } from "@/lib/invites";
import { isValidEmailShape, normalizeEmail } from "@/lib/user-validation";
import { getAppBaseUrlFromRequest } from "@/lib/app-base-url";
import { sendParentInviteEmail, isPasswordResetEmailConfigured } from "@/lib/auth-email";
import { getStudentByIdWithBatchForUser } from "@/lib/students-queries";
import { baseCtxFromRequest, logError, logInfo, logWarn } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/students/[id]/parent-invite";

const PARENT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id: rawStudentId } = await params;
  const studentId = typeof rawStudentId === "string" ? rawStudentId.trim() : "";
  if (!studentId) {
    return apiError({
      code: "STUDENT_ID_REQUIRED",
      message: "Student id is required.",
      status: 400,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return apiError({
      code: "STUDENT_PARENT_INVITE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }
  const emailRaw =
    typeof (body as Record<string, unknown>).email === "string"
      ? ((body as Record<string, unknown>).email as string)
      : "";
  if (!isValidEmailShape(emailRaw)) {
    return apiError({
      code: "STUDENT_PARENT_INVITE_BAD_REQUEST",
      message: "Enter a valid email address.",
      status: 400,
    });
  }
  const email = normalizeEmail(emailRaw);

  const userRaw = await getSessionUser();
  const admin = await requireRoleWithInstitute(userRaw, [ROLE_ADMIN]);
  if (admin instanceof NextResponse) return admin;

  const student = await getStudentByIdWithBatchForUser(admin, studentId);
  if (!student) {
    return apiError({
      code: "STUDENT_NOT_FOUND",
      message: "Student not found.",
      status: 404,
    });
  }

  const instituteId = student.instituteId;
  if (!instituteId) {
    return apiError({
      code: "STUDENT_PARENT_INVITE_BAD_REQUEST",
      message: "Student must belong to an institute before inviting a parent.",
      status: 400,
    });
  }

  const now = new Date();

  const staffInviteBlock = await prisma.invite.findFirst({
    where: {
      instituteId,
      email,
      usedAt: null,
      expiresAt: { gt: now },
      studentId: null,
    },
    select: { id: true },
  });
  if (staffInviteBlock) {
    return apiError({
      code: "STUDENT_PARENT_INVITE_CONFLICT",
      message:
        "A staff invite is already pending for this email. Resolve it before inviting a parent.",
      status: 409,
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, instituteId: true },
  });
  if (existingUser && existingUser.role !== ROLE_PARENT) {
    return apiError({
      code: "STUDENT_PARENT_INVITE_EMAIL_NOT_ALLOWED",
      message: "Unable to send a parent invite for this email.",
      status: 400,
    });
  }
  if (existingUser?.instituteId && existingUser.instituteId !== instituteId) {
    return apiError({
      code: "STUDENT_PARENT_INVITE_EMAIL_NOT_ALLOWED",
      message: "Unable to send a parent invite for this email.",
      status: 400,
    });
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + PARENT_INVITE_TTL_MS);

  const inviteFullName =
    student.parentName?.trim() || `Parent — ${student.fullName.trim() || "student"}`;

  await prisma.$transaction(async (tx) => {
    const placeholderPassword = generateInviteToken();
    const placeholderHash = await bcrypt.hash(placeholderPassword, 12);

    let parentRow: { id: string };
    if (existingUser?.id) {
      parentRow = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          instituteId: existingUser.instituteId ?? instituteId,
          role: ROLE_PARENT,
          branchId: null,
        },
        select: { id: true },
      });
    } else {
      parentRow = await tx.user.create({
        data: {
          email,
          passwordHash: placeholderHash,
          role: ROLE_PARENT,
          instituteId,
          branchId: null,
        },
        select: { id: true },
      });
    }

    await tx.student.update({
      where: { id: student.id, instituteId },
      data: { parentUserId: parentRow.id },
    });

    await tx.invite.updateMany({
      where: {
        studentId: student.id,
        instituteId,
        role: ROLE_PARENT,
        usedAt: null,
      },
      data: { usedAt: now },
    });

    await tx.invite.create({
      data: {
        email,
        fullName: inviteFullName,
        role: ROLE_PARENT,
        instituteId,
        branchId: null,
        studentId: student.id,
        inviterUserId: admin.id,
        invitedUserId: parentRow.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  const baseUrl = getAppBaseUrlFromRequest(req);
  const path = `/parent/accept-invite?token=${encodeURIComponent(token)}`;
  const inviteUrl = baseUrl ? `${baseUrl}${path}` : path;

  if (process.env.NODE_ENV !== "production") {
    logInfo("students.parent_invite.dev_invite_url", logCtx, {
      studentId: student.id,
      inviteUrl,
    });
  }

  const emailConfigured = isPasswordResetEmailConfigured();
  if (emailConfigured) {
    try {
      await sendParentInviteEmail(email, inviteUrl);
    } catch (err) {
      logError("students.parent_invite.email_send_failed", logCtx, err, {
        studentId: student.id,
      });
    }
  } else if (process.env.NODE_ENV !== "production") {
    logWarn("students.parent_invite.dev_email_not_configured", logCtx, {
      studentId: student.id,
      hint: "Invite persisted; no email sent (SMTP not configured). URL was logged for local use.",
    });
  } else {
    logWarn("students.parent_invite.email_not_configured", logCtx, {
      studentId: student.id,
    });
  }

  return NextResponse.json({ ok: true, message: "Parent invite created." });
}
