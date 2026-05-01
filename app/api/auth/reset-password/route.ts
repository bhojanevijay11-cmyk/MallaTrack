import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPasswordForStorage, hashPasswordResetToken } from "@/lib/password-reset";
import { validatePassword } from "@/lib/user-validation";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";

const INVALID_TOKEN_MESSAGE =
  "This reset link is invalid or has expired. Request a new one from the login page.";

export async function POST(req: Request) {
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

  const b = body as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const confirmPassword = typeof b.confirmPassword === "string" ? b.confirmPassword : "";

  if (!token) {
    return apiError({
      code: "INVALID_TOKEN",
      message: INVALID_TOKEN_MESSAGE,
      status: 400,
    });
  }

  if (password !== confirmPassword) {
    return apiError({
      code: "PASSWORDS_DO_NOT_MATCH",
      message: "Passwords do not match.",
      status: 400,
    });
  }

  const pw = validatePassword(password);
  if (!pw.ok) {
    return apiError({
      code: "WEAK_PASSWORD",
      message: pw.message,
      status: 400,
    });
  }

  const tokenHash = hashPasswordResetToken(token);
  const user = await prisma.user.findUnique({
    where: { passwordResetTokenHash: tokenHash },
    select: { id: true, passwordResetExpires: true },
  });

  const now = new Date();
  if (
    !user ||
    !user.passwordResetExpires ||
    user.passwordResetExpires.getTime() < now.getTime()
  ) {
    return apiError({
      code: "INVALID_TOKEN",
      message: INVALID_TOKEN_MESSAGE,
      status: 400,
    });
  }

  const passwordHash = await hashPasswordForStorage(password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
    },
  });

  return NextResponse.json({
    ok: true as const,
    message: "Your password has been updated. You can sign in now.",
  });
}
