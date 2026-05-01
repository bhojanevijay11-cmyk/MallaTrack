import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import { baseCtxFromRequest, logError } from "@/lib/server-log";
import { ROLE_ADMIN } from "@/lib/roles";

export const runtime = "nodejs";

const ROUTE = "/api/branches";

export async function GET() {
  const userRaw = await getSessionUser();
  const user = await requireRoleWithInstitute(userRaw, [ROLE_ADMIN]);
  if (user instanceof NextResponse) return user;

  const branches = await prisma.branch.findMany({
    where: { instituteId: user.instituteId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json({
    ok: true,
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      createdAt: b.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
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
      code: "BRANCH_CREATE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }

  const rawName = (body as Record<string, unknown>).name;
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) {
    return apiError({
      code: "BRANCH_CREATE_BAD_REQUEST",
      message: "Branch name is required.",
      status: 400,
    });
  }

  const duplicate = await prisma.branch.findFirst({
    where: { instituteId: user.instituteId, name },
    select: { id: true },
  });
  if (duplicate) {
    return apiError({
      code: "BRANCH_CREATE_CONFLICT",
      message: "A branch with this name already exists.",
      status: 409,
    });
  }

  try {
    const created = await prisma.branch.create({
      data: { name, instituteId: user.instituteId },
      select: { id: true, name: true, createdAt: true },
    });
    return NextResponse.json({
      ok: true,
      branch: {
        id: created.id,
        name: created.name,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (e) {
    logError("branches.create_failed", logCtx, e, { instituteId: user.instituteId });
    return apiError({
      code: "BRANCH_CREATE_FAILED",
      message: prismaErrorUserMessage(e, "Could not create branch."),
      status: 400,
    });
  }
}
