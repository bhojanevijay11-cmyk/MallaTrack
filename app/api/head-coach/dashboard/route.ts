import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { getHeadCoachDashboardSnapshot } from "@/lib/head-coach-branch-data";
import { ROLE_HEAD_COACH } from "@/lib/roles";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/head-coach/dashboard";

export async function GET(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getSessionUser();
  const user = await requireRoleWithInstitute(userRaw, [ROLE_HEAD_COACH]);
  if (user instanceof NextResponse) return user;
  try {
    const snapshot = await getHeadCoachDashboardSnapshot(user.branchId ?? null, user.instituteId, {
      userId: user.id,
    });
    return NextResponse.json(
      {
        ok: true,
        branchId: user.branchId ?? null,
        snapshot,
      },
      { status: 200 },
    );
  } catch (err) {
    logError("head_coach.dashboard_failed", logCtx, err, {
      userId: user.id,
      instituteId: user.instituteId,
      branchId: user.branchId ?? null,
    });
    return apiError({
      code: "HEAD_COACH_DASHBOARD_FAILED",
      message: "Could not load dashboard.",
      status: 500,
    });
  }
}
