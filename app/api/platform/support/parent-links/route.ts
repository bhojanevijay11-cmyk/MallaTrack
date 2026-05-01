import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireSuperAdminApi } from "@/lib/platform-auth";
import {
  getPlatformParentLinks,
  parseSupportLimit,
} from "@/lib/platform-support";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

const ROUTE = "/api/platform/support/parent-links";

export async function GET(req: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) return auth;

  const logCtx = baseCtxFromRequest(req, ROUTE);

  try {
    const { searchParams } = new URL(req.url);
    const instituteId = searchParams.get("instituteId");
    const parentEmail = searchParams.get("parentEmail");
    const studentId = searchParams.get("studentId");
    const limit = parseSupportLimit(searchParams.get("limit"), 50);

    const result = await getPlatformParentLinks({
      instituteId,
      parentEmail,
      studentId,
      limit,
    });
    return NextResponse.json(result);
  } catch (e) {
    logError("platform.support.parent_links_failed", logCtx, e);
    return apiError({
      code: "PLATFORM_SUPPORT_PARENT_LINKS_FAILED",
      message: "Unable to load parent links.",
      status: 500,
    });
  }
}
