import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getParentProgressAssessmentDetail } from "@/lib/parent-dashboard-queries";
import { ROLE_PARENT } from "@/lib/roles";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/parent/progress-assessments/[assessmentId]";

/**
 * Parent-only read of a single APPROVED assessment linked to the signed-in parent.
 * Draft / pending / needs_revision / other students → 404 (no existence leak).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { assessmentId: rawAid } = await params;
  const assessmentId = typeof rawAid === "string" ? rawAid.trim() : "";

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, [ROLE_PARENT]);
  if (user instanceof NextResponse) return user;

  if (!assessmentId) {
    return apiError({ code: "PARENT_ASSESSMENT_ID_REQUIRED", message: "Not found.", status: 404 });
  }

  try {
    const report = await getParentProgressAssessmentDetail(
      user.id,
      user.instituteId,
      assessmentId,
    );
    if (!report) {
      return apiError({ code: "PARENT_ASSESSMENT_NOT_FOUND", message: "Not found.", status: 404 });
    }

    return NextResponse.json({ ok: true, report }, { status: 200 });
  } catch (e) {
    logError("parent.progress_assessment_detail_failed", logCtx, e, {
      instituteId: user.instituteId,
    });
    return apiError({
      code: "PARENT_ASSESSMENT_LOAD_FAILED",
      message: "Could not load this report.",
      status: 500,
    });
  }
}
