import { NextResponse } from "next/server";
import {
  createCoach,
  getCoachesVisibleToUser,
  toCoachApiRecord,
} from "@/lib/coaches-queries";
import { apiError } from "@/lib/api-response";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import { baseCtxFromRequest, logError } from "@/lib/server-log";
import { APP_ADMIN_HEAD_ROLES, ROLE_ADMIN } from "@/lib/roles";

export const runtime = "nodejs";

const ROUTE = "/api/coaches";

export async function GET(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getSessionUser();
  const user = await requireRoleWithInstitute(userRaw, APP_ADMIN_HEAD_ROLES);
  if (user instanceof NextResponse) return user;

  try {
    const coaches = await getCoachesVisibleToUser(user);
    return NextResponse.json(
      { ok: true, coaches: coaches.map(toCoachApiRecord) },
      { status: 200 },
    );
  } catch (e) {
    logError("coaches.list_failed", logCtx, e, { instituteId: user.instituteId });
    return apiError({
      code: "COACHES_LIST_FAILED",
      message: "Failed to fetch coaches.",
      status: 500,
    });
  }
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
      code: "COACH_CREATE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }

  const b = body as Record<string, unknown>;
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  if (!fullName) {
    return apiError({
      code: "COACH_CREATE_BAD_REQUEST",
      message: "Missing required field: fullName.",
      status: 400,
    });
  }

  const phone =
    typeof b.phone === "string" && b.phone.trim() ? b.phone.trim() : null;

  try {
    const coach = await createCoach({
      fullName,
      phone,
      instituteId: user.instituteId,
    });
    return NextResponse.json(
      { ok: true, coach: toCoachApiRecord(coach) },
      { status: 201 },
    );
  } catch (err) {
    logError("coaches.create_failed", logCtx, err, { instituteId: user.instituteId });
    const message = prismaErrorUserMessage(err, "Could not create coach. Please try again.");
    return apiError({ code: "COACH_CREATE_FAILED", message, status: 500 });
  }
}
