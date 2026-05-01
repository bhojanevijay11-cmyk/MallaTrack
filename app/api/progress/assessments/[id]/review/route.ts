import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { assertProgressAssessmentAccess } from "@/lib/authz-assertions";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import {
  progressAssessmentListSelect,
  serializeProgressAssessmentListRow,
} from "@/lib/progress-assessment-payload";
import { ROLE_ADMIN, ROLE_HEAD_COACH } from "@/lib/roles";
import { apiError } from "@/lib/api-response";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/progress/assessments/[id]/review";

function notFound() {
  return apiError({ code: "NOT_FOUND", message: "Not found.", status: 404 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id: rawId } = await params;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id) return notFound();

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, [ROLE_HEAD_COACH, ROLE_ADMIN]);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return apiError({
      code: "INVALID_BODY",
      message: "Invalid request body.",
      status: 400,
    });
  }
  const b = body as Record<string, unknown>;

  const action = b.action === "approve" || b.action === "request_correction" ? b.action : null;
  if (!action) {
    return apiError({
      code: "INVALID_ACTION",
      message: 'Body "action" must be "approve" or "request_correction".',
      status: 400,
    });
  }

  const existing = await prisma.progressAssessment.findUnique({
    where: { id },
    select: {
      id: true,
      instituteId: true,
      studentId: true,
      status: true,
      submittedByUserId: true,
    },
  });
  if (!existing) return notFound();
  const denied = await assertProgressAssessmentAccess(user, existing);
  if (denied) return denied;

  if (existing.instituteId !== user.instituteId) {
    return notFound();
  }

  if (existing.status !== PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW) {
    return apiError({
      code: "INVALID_STATUS",
      message: "Only pending-review assessments can be reviewed.",
      status: 409,
    });
  }

  if (existing.submittedByUserId !== null && existing.submittedByUserId === user.id) {
    return apiError({
      code: "REVIEW_SELF_SUBMIT_FORBIDDEN",
      message: "You cannot review an assessment you submitted for approval.",
      status: 403,
    });
  }

  let reviewNoteUpdate: string | null | undefined;
  if ("reviewNote" in b) {
    if (b.reviewNote === null) {
      reviewNoteUpdate = null;
    } else if (typeof b.reviewNote === "string") {
      reviewNoteUpdate = b.reviewNote.trim().slice(0, 4000) || null;
    } else {
      return apiError({
        code: "INVALID_REVIEW_NOTE",
        message: "Invalid reviewNote.",
        status: 400,
      });
    }
  }

  if (action === "request_correction") {
    if (typeof reviewNoteUpdate !== "string" || reviewNoteUpdate.length < 3) {
      return apiError({
        code: "REVIEW_NOTE_REQUIRED",
        message: "Revision requests must include feedback (at least 3 characters).",
        status: 400,
      });
    }
  }

  const now = new Date();
  const nextStatus =
    action === "approve"
      ? PROGRESS_ASSESSMENT_STATUS.APPROVED
      : PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION;

  const patch: Prisma.ProgressAssessmentUncheckedUpdateManyInput = {
    status: nextStatus,
    reviewedAt: now,
    reviewedByUserId: user.id,
  };

  if (reviewNoteUpdate !== undefined) {
    patch.reviewNote = reviewNoteUpdate;
  }

  try {
    const updated = await prisma.progressAssessment.updateMany({
      where: {
        id,
        instituteId: user.instituteId,
        status: PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW,
      },
      data: patch,
    });

    if (updated.count === 0) {
      const fresh = await prisma.progressAssessment.findUnique({
        where: { id },
        select: { status: true, instituteId: true },
      });
      if (!fresh || fresh.instituteId !== user.instituteId) {
        return notFound();
      }
      return apiError({
        code: "REVIEW_STALE_STATE",
        message:
          "This assessment is no longer pending review. Refresh the queue and try again.",
        status: 409,
      });
    }

    const row = await prisma.progressAssessment.findUnique({
      where: { id },
      select: progressAssessmentListSelect,
    });
    if (!row) return notFound();

    return NextResponse.json({ ok: true, assessment: serializeProgressAssessmentListRow(row) });
  } catch (e) {
    logError("progress.assessments.review_failed", logCtx, e, {
      assessmentId: id,
      instituteId: user.instituteId,
    });
    return apiError({
      code: "REVIEW_UPDATE_FAILED",
      message: "Could not apply this review. Please try again.",
      status: 500,
    });
  }
}
