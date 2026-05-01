import { NextResponse } from "next/server";
import { sendPasswordResetEmail, isPasswordResetEmailConfigured } from "@/lib/auth-email";
import { getAppBaseUrlFromRequest } from "@/lib/app-base-url";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { baseCtxFromRequest, logError, logWarn } from "@/lib/server-log";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_EXPIRY_MS,
} from "@/lib/password-reset";
import { isValidEmailShape, normalizeEmail } from "@/lib/user-validation";

export const runtime = "nodejs";

const GENERIC_BODY = {
  ok: true as const,
  message: "If an account exists, reset instructions have been sent.",
};

export async function POST(req: Request) {
  const logCtx = baseCtxFromRequest(req, "/api/auth/forgot-password");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({
      code: "BAD_JSON",
      message: "Invalid request body.",
      status: 400,
    });
  }

  if (!body || typeof body !== "object") {
    return apiError({
      code: "INVALID_BODY",
      message: "Invalid request body.",
      status: 400,
    });
  }

  const emailRaw = typeof (body as Record<string, unknown>).email === "string"
    ? (body as Record<string, unknown>).email as string
    : "";

  if (!isValidEmailShape(emailRaw)) {
    return NextResponse.json(GENERIC_BODY);
  }

  const email = normalizeEmail(emailRaw);
  const isProd = process.env.NODE_ENV === "production";
  const emailConfigured = isPasswordResetEmailConfigured();

  if (isProd && !emailConfigured) {
    logWarn("auth.password_reset_unavailable", {
      ...logCtx,
      errorCode: "PASSWORD_RESET_EMAIL_NOT_CONFIGURED",
    });
    return NextResponse.json(GENERIC_BODY);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    return NextResponse.json(GENERIC_BODY);
  }

  const plain = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(plain);
  const expires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: expires,
    },
  });

  const baseUrl = getAppBaseUrlFromRequest(req);
  const resetUrl = baseUrl
    ? `${baseUrl}/reset-password?token=${plain}`
    : `/reset-password?token=${plain}`;

  if (emailConfigured) {
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (err) {
      logError(
        "auth.password_reset_email_failed",
        {
          ...logCtx,
          userId: user.id,
          role: null,
          instituteId: null,
          errorCode: "PASSWORD_RESET_EMAIL_SEND_FAILED",
        },
        err,
      );
    }
  } else {
    console.info("[MallaTrack] Password reset link (dev, email not configured):\n" + resetUrl);
  }

  return NextResponse.json(GENERIC_BODY);
}
