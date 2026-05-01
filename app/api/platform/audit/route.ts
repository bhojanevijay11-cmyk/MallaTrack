import { NextResponse } from "next/server";
import {
  getPlatformAuditLogs,
  parseAuditLimit,
} from "@/lib/platform-audit";
import { requireSuperAdminApi } from "@/lib/platform-auth";
import { apiError } from "@/lib/api-response";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

const ROUTE = "/api/platform/audit";

export async function GET(req: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) return auth;

  const logCtx = baseCtxFromRequest(req, ROUTE);

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const instituteId = searchParams.get("instituteId");
    const targetType = searchParams.get("targetType");
    const limit = parseAuditLimit(searchParams.get("limit"));

    const result = await getPlatformAuditLogs({
      action,
      instituteId,
      targetType,
      limit,
    });
    return NextResponse.json(result);
  } catch (e) {
    logError("platform.audit.query_failed", logCtx, e);
    return apiError({
      code: "PLATFORM_AUDIT_QUERY_FAILED",
      message: "Unable to load audit logs.",
      status: 500,
    });
  }
}
