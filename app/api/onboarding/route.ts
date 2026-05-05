import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireRole } from "@/lib/auth-server";
import { APP_STAFF_ROLES, roleHomePath } from "@/lib/roles";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/onboarding";

function parseNames(body: unknown): { ok: true; instituteName: string; branchName: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;
  const instituteName =
    typeof b.instituteName === "string" ? b.instituteName.trim() : "";
  const branchName = typeof b.branchName === "string" ? b.branchName.trim() : "";
  if (instituteName.length < 2) {
    return { ok: false, error: "Institute name must be at least 2 characters." };
  }
  if (instituteName.length > 200) {
    return { ok: false, error: "Institute name is too long." };
  }
  if (branchName.length < 1) {
    return {
      ok: false,
      error: "Branch location / center name is required.",
    };
  }
  if (branchName.length > 200) {
    return {
      ok: false,
      error: "Branch location / center name is too long.",
    };
  }
  return { ok: true, instituteName, branchName };
}

export async function POST(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "ONBOARDING_BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }

  const parsed = parseNames(body);
  if (!parsed.ok) {
    return apiError({
      code: "ONBOARDING_BAD_REQUEST",
      message: parsed.error,
      status: 400,
    });
  }

  const userRaw = await getSessionUser();
  const user = requireRole(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

  if (user.instituteId !== null) {
    return apiError({
      code: "ONBOARDING_ALREADY_INSTITUTE",
      message: "Your account already belongs to an institute.",
      status: 409,
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: user.id },
        select: { instituteId: true },
      });
      if (existing?.instituteId !== null) {
        throw new Error("ALREADY_ONBOARDED");
      }

      const institute = await tx.institute.create({
        data: { name: parsed.instituteName },
        select: { id: true, name: true },
      });
      const branch = await tx.branch.create({
        data: {
          name: parsed.branchName,
          instituteId: institute.id,
        },
        select: { id: true },
      });

      const updated = await tx.user.updateMany({
        where: { id: user.id, instituteId: null },
        data: {
          instituteId: institute.id,
          branchId: branch.id,
        },
      });

      if (updated.count === 0) {
        throw new Error("RACE");
      }

      return {
        instituteId: institute.id,
        instituteName: institute.name,
        branchId: branch.id,
      };
    });

    return NextResponse.json({
      ok: true,
      instituteId: result.instituteId,
      instituteName: result.instituteName,
      branchId: result.branchId,
      redirectTo: roleHomePath(user.role),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_ONBOARDED") {
      return apiError({
        code: "ONBOARDING_ALREADY_INSTITUTE",
        message: "Your account already belongs to an institute.",
        status: 409,
      });
    }
    if (e instanceof Error && e.message === "RACE") {
      return apiError({
        code: "ONBOARDING_RACE",
        message: "Setup was already completed. Refresh the page.",
        status: 409,
      });
    }
    logError("onboarding.transaction_failed", logCtx, e, { userId: user.id });
    return apiError({
      code: "ONBOARDING_FAILED",
      message: "Could not complete setup. Please try again.",
      status: 500,
    });
  }
}
