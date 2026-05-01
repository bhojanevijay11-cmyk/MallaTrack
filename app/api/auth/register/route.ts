import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureDefaultBranch } from "@/lib/branch-default";
import { ensureDefaultInstitute } from "@/lib/institute-default";
import { validateRegisterPayload } from "@/lib/user-validation";
import { ROLE_HEAD_COACH } from "@/lib/roles";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({
      code: "BAD_JSON",
      message: "Invalid JSON body.",
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
  const parsed = validateRegisterPayload({
    email: typeof b.email === "string" ? b.email : "",
    password: typeof b.password === "string" ? b.password : "",
    confirmPassword:
      typeof b.confirmPassword === "string" ? b.confirmPassword : "",
    role: typeof b.role === "string" ? b.role : "",
  });

  if (!parsed.ok) {
    return apiError({
      code: "VALIDATION_FAILED",
      message: parsed.message,
      status: 400,
    });
  }

  if (parsed.role === "admin") {
    return apiError({
      code: "ROLE_NOT_ALLOWED",
      message: "Admin accounts cannot be created through public registration.",
      status: 403,
    });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: parsed.email },
    });
    if (existing) {
      return apiError({
        code: "EMAIL_ALREADY_EXISTS",
        message: "An account with this email already exists.",
        status: 409,
      });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const institute = await ensureDefaultInstitute();
    const defaultBranch =
      parsed.role === ROLE_HEAD_COACH ? await ensureDefaultBranch() : null;

    await prisma.user.create({
      data: {
        email: parsed.email,
        passwordHash,
        role: parsed.role,
        branchId: defaultBranch?.id ?? null,
        instituteId: institute.id,
      },
    });

    return NextResponse.json(
      { ok: true, message: "Account created. You can sign in now." },
      { status: 201 },
    );
  } catch {
    return apiError({
      code: "REGISTER_FAILED",
      message: "Registration failed. Please try again.",
      status: 500,
    });
  }
}
