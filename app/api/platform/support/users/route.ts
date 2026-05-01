import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireSuperAdminApi } from "@/lib/platform-auth";
import {
  getPlatformSupportUsers,
  parseSupportLimit,
} from "@/lib/platform-support";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

const ROUTE = "/api/platform/support/users";

export async function GET(req: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) return auth;

  const logCtx = baseCtxFromRequest(req, ROUTE);

  try {
    const { searchParams } = new URL(req.url);
    const instituteId = searchParams.get("instituteId");
    const role = searchParams.get("role");
    const q = searchParams.get("q");
    const limit = parseSupportLimit(searchParams.get("limit"), 50);

    const result = await getPlatformSupportUsers({
      instituteId,
      role,
      q,
      limit,
    });
    return NextResponse.json(result);
  } catch (e) {
    logError("platform.support.users_failed", logCtx, e);
    return apiError({
      code: "PLATFORM_SUPPORT_USERS_FAILED",
      message: "Unable to load support users.",
      status: 500,
    });
  }
}
