import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireSuperAdminApi } from "@/lib/platform-auth";
import { getPlatformInstituteSummaries } from "@/lib/platform-institutes";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

const ROUTE = "/api/platform/institutes";

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
