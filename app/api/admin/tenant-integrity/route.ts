import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { ROLE_ADMIN } from "@/lib/roles";
import { runTenantIntegrityDiagnostics } from "@/lib/tenant-integrity-diagnostics";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/admin/tenant-integrity";

/**
 * Admin-only, single-tenant integrity report (no cross-institute leakage).
 * Grep: tenant-integrity-diagnostics
 */
export async function GET(req: Request) {
  const userRaw = await getSessionUser();
  const user = await requireRoleWithInstitute(userRaw, [ROLE_ADMIN]);
  if (user instanceof NextResponse) return user;

  const logCtx = baseCtxFromRequest(req, ROUTE);

  try {
    const report = await runTenantIntegrityDiagnostics(user.instituteId);
    return NextResponse.json({ ok: true, report }, { status: 200 });
  } catch (e) {
    logError("admin.tenant_integrity.diagnostics_failed", logCtx, e);
    return apiError({
      code: "TENANT_INTEGRITY_DIAGNOSTICS_FAILED",
      message: "Could not run tenant integrity diagnostics.",
      status: 500,
    });
  }
}
