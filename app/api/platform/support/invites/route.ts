import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireSuperAdminApi } from "@/lib/platform-auth";
import {
  getPlatformSupportInvites,
  parseSupportLimit,
  type PlatformSupportInviteStatus,
} from "@/lib/platform-support";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

const ROUTE = "/api/platform/support/invites";

function parseInviteStatus(
  raw: string | null,
): PlatformSupportInviteStatus | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (s === "pending" || s === "expired" || s === "used") return s;
  return null;
}

export async function GET(req: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) return auth;

  const logCtx = baseCtxFromRequest(req, ROUTE);

  try {
    const { searchParams } = new URL(req.url);
    const instituteId = searchParams.get("instituteId");
    const role = searchParams.get("role");
    const status = parseInviteStatus(searchParams.get("status"));
    const limit = parseSupportLimit(searchParams.get("limit"), 50);

    const result = await getPlatformSupportInvites({
      instituteId,
      role,
      status,
      limit,
    });
    return NextResponse.json(result);
  } catch (e) {
    logError("platform.support.invites_failed", logCtx, e);
    return apiError({
      code: "PLATFORM_SUPPORT_INVITES_FAILED",
      message: "Unable to load support invites.",
      status: 500,
    });
  }
}
