import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { createPlatformAuditLog } from "@/lib/platform-audit";
import { requireSuperAdminApi } from "@/lib/platform-auth";
import { executePlatformHealthRepair } from "@/lib/platform-health-repair";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

const ROUTE = "/api/platform/health/repair";

function repairFailureCode(status: number): string {
  if (status === 404) return "HEALTH_REPAIR_NOT_FOUND";
  if (status === 409) return "HEALTH_REPAIR_CONFLICT";
  return "HEALTH_REPAIR_BAD_REQUEST";
}

export async function POST(req: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) return auth;

  const logCtx = baseCtxFromRequest(req, ROUTE);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({
      code: "BAD_JSON",
      message: "Invalid JSON body.",
      status: 400,
    });
  }

  try {
    const outcome = await executePlatformHealthRepair(body);
    if (!outcome.ok) {
      return apiError({
        code: repairFailureCode(outcome.status),
        message: outcome.error,
        status: outcome.status,
      });
    }

    void createPlatformAuditLog({
      actorUserId: auth.id,
      action: outcome.audit.action,
      targetType: outcome.audit.targetType,
      targetId: outcome.audit.targetId,
      instituteId: outcome.audit.instituteId,
      metadata: outcome.audit.metadata,
    });

    return NextResponse.json({
      ok: true,
      message: outcome.message,
      result: outcome.result,
    });
  } catch (e) {
    logError("platform.health.repair_failed", logCtx, e);
    return apiError({
      code: "HEALTH_REPAIR_INTERNAL",
      message: "Unable to apply repair.",
      status: 500,
    });
  }
}
