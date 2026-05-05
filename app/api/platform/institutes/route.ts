import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import {
  createPlatformAuditLog,
  PLATFORM_AUDIT_ACTION_INSTITUTE_PROVISIONED,
  PLATFORM_AUDIT_TARGET_INSTITUTE,
} from "@/lib/platform-audit";
import { requireSuperAdminApi } from "@/lib/platform-auth";
import { getPlatformInstituteSummaries } from "@/lib/platform-institutes";
import { prisma } from "@/lib/prisma";
import { ROLE_ADMIN } from "@/lib/roles";
import { baseCtxFromRequest, logError, logInfo } from "@/lib/server-log";
import {
  isValidEmailShape,
  normalizeEmail,
  validatePassword,
} from "@/lib/user-validation";

const ROUTE = "/api/platform/institutes";

const MAX_NAME_LEN = 200;

function parseProvisionBody(body: unknown): {
  ok: true;
  instituteName: string;
  firstBranchLocationName: string;
  adminFullName: string;
  adminEmail: string;
  temporaryPassword: string;
} | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Invalid request body." };
  }
  const o = body as Record<string, unknown>;
  const instituteName =
    typeof o.instituteName === "string" ? o.instituteName.trim() : "";
  const firstBranchLocationName =
    typeof o.firstBranchLocationName === "string"
      ? o.firstBranchLocationName.trim()
      : "";
  const adminFullName =
    typeof o.adminFullName === "string" ? o.adminFullName.trim() : "";
  const adminEmailRaw =
    typeof o.adminEmail === "string" ? o.adminEmail.trim() : "";
  const adminEmail = normalizeEmail(adminEmailRaw);
  const temporaryPassword =
    typeof o.temporaryPassword === "string" ? o.temporaryPassword : "";

  if (!instituteName) {
    return { ok: false, message: "Institute name is required." };
  }
  if (instituteName.length > MAX_NAME_LEN) {
    return { ok: false, message: "Institute name is too long." };
  }
  if (!firstBranchLocationName) {
    return {
      ok: false,
      message: "Branch location / center name is required.",
    };
  }
  if (firstBranchLocationName.length > MAX_NAME_LEN) {
    return {
      ok: false,
      message: "Branch location / center name is too long.",
    };
  }
  if (!adminFullName) {
    return { ok: false, message: "Admin full name is required." };
  }
  if (adminFullName.length > MAX_NAME_LEN) {
    return { ok: false, message: "Admin full name is too long." };
  }
  if (!adminEmail) {
    return { ok: false, message: "Admin email is required." };
  }
  if (!isValidEmailShape(adminEmailRaw)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const pw = validatePassword(temporaryPassword);
  if (!pw.ok) return pw;

  return {
    ok: true,
    instituteName,
    firstBranchLocationName,
    adminFullName,
    adminEmail,
    temporaryPassword,
  };
}

export async function GET(req: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) return auth;

  const logCtx = baseCtxFromRequest(req, ROUTE);

  try {
    const institutes = await getPlatformInstituteSummaries();
    return NextResponse.json({ institutes });
  } catch (e) {
    logError("platform.institutes.list_failed", logCtx, e);
    return apiError({
      code: "PLATFORM_INSTITUTES_LIST_FAILED",
      message: "Unable to load institutes.",
      status: 500,
    });
  }
}

export async function POST(req: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) return auth;

  const logCtx = {
    ...baseCtxFromRequest(req, ROUTE),
    userId: auth.id,
    role: auth.role,
  };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({
      code: "INVALID_JSON",
      message: "Invalid JSON body.",
      status: 400,
    });
  }

  const parsed = parseProvisionBody(body);
  if (!parsed.ok) {
    return apiError({
      code: "VALIDATION_ERROR",
      message: parsed.message,
      status: 400,
    });
  }

  const {
    instituteName,
    firstBranchLocationName,
    adminFullName,
    adminEmail,
    temporaryPassword,
  } = parsed;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });
    if (existingUser) {
      return apiError({
        code: "ADMIN_EMAIL_EXISTS",
        message: "A user with this email already exists.",
        status: 409,
      });
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const result = await prisma.$transaction(async (tx) => {
      const institute = await tx.institute.create({
        data: { name: instituteName },
        select: { id: true, name: true },
      });
      await tx.branch.create({
        data: {
          name: firstBranchLocationName,
          instituteId: institute.id,
        },
        select: { id: true },
      });
      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          role: ROLE_ADMIN,
          instituteId: institute.id,
          branchId: null,
        },
        select: { id: true, email: true, role: true, instituteId: true },
      });
      return { institute, adminUser };
    });

    void createPlatformAuditLog({
      actorUserId: auth.id,
      action: PLATFORM_AUDIT_ACTION_INSTITUTE_PROVISIONED,
      targetType: PLATFORM_AUDIT_TARGET_INSTITUTE,
      targetId: result.institute.id,
      instituteId: result.institute.id,
      metadata: {
        instituteName: result.institute.name,
        firstBranchLocationName,
        adminUserId: result.adminUser.id,
        adminEmail: result.adminUser.email,
        adminFullName,
      },
    });

    logInfo("platform.institutes.provisioned", logCtx, {
      instituteId: result.institute.id,
      adminUserId: result.adminUser.id,
    });

    return NextResponse.json(
      {
        instituteId: result.institute.id,
        adminUserId: result.adminUser.id,
      },
      { status: 201 },
    );
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return apiError({
        code: "ADMIN_EMAIL_EXISTS",
        message: "A user with this email already exists.",
        status: 409,
      });
    }
    logError("platform.institutes.provision_failed", logCtx, e);
    return apiError({
      code: "PLATFORM_INSTITUTE_PROVISION_FAILED",
      message: "Could not create institute. Try again later.",
      status: 500,
    });
  }
}
