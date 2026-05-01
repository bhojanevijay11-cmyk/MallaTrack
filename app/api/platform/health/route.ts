import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireSuperAdminApi } from "@/lib/platform-auth";
import { getPlatformHealthReport } from "@/lib/platform-health";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

const ROUTE = "/api/platform/health";

export async function GET(req: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) return auth;

  const logCtx = baseCtxFromRequest(req, ROUTE);

  try {
    const report = await getPlatformHealthReport();
    return NextResponse.json(report);
  } catch (e) {
    logError("platform.health.report_failed", logCtx, e);
    return apiError({
      code: "PLATFORM_HEALTH_REPORT_FAILED",
      message: "Unable to load platform health report.",
      status: 500,
    });
  }
}
