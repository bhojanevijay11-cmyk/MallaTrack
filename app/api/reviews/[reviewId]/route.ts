import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { APP_STAFF_ROLES, ROLE_ASSISTANT_COACH } from "@/lib/roles";
import { canAccessStudent } from "@/lib/scope";
import {
  parseStudentReviewStatus,
  parseStudentReviewVisibility,
} from "@/lib/student-review-constants";
import {
  canEditStudentReview,
  canSetStudentReviewStatus,
} from "@/lib/student-review-permissions";
import {
  serializeStudentReview,
  studentReviewListInclude,
} from "@/lib/student-review-payload";
import { logCtxWithActor, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/reviews/[reviewId]";

function parseTitle(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t === "" ? null : t;
}

function parseNote(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t === "" ? null : t;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await params;
  if (!reviewId?.trim()) {
    return apiError({
      code: "STUDENT_REVIEW_BAD_REQUEST",
      message: "Review id is required.",
      status: 400,
    });
  }

  const userRaw = await getSessionUser();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

  const logCtx = logCtxWithActor(req, ROUTE, {
    userId: user.id,
    instituteId: user.instituteId,
    role: user.role,
  });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return apiError({
      code: "STUDENT_REVIEW_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }
  const b = body as Record<string, unknown>;

  const hasTitle = "title" in b;
  const hasNote = "note" in b;
  const hasVisibility = "visibility" in b;
  const hasStatus = "status" in b;
  if (!hasTitle && !hasNote && !hasVisibility && !hasStatus) {
    return apiError({
      code: "STUDENT_REVIEW_BAD_REQUEST",
      message: "Provide at least one of title, note, visibility, status.",
      status: 400,
    });
  }

  if (user.role === ROLE_ASSISTANT_COACH && hasStatus) {
    return apiError({
      code: "STUDENT_REVIEW_STATUS_FORBIDDEN",
      message: "Assistant coaches cannot change publish status.",
      status: 403,
    });
  }

  const existing = await prisma.studentReview.findUnique({
    where: { id: reviewId.trim() },
    include: studentReviewListInclude,
  });
  if (!existing || existing.instituteId !== user.instituteId) {
    return apiError({
      code: "STUDENT_REVIEW_NOT_FOUND",
      message: "Review not found.",
      status: 404,
    });
  }

  if (!(await canAccessStudent(user, existing.studentId))) {
    return apiError({
      code: "STUDENT_REVIEW_NOT_FOUND",
      message: "Review not found.",
      status: 404,
    });
  }

  if (!(await canEditStudentReview(user, existing))) {
    return apiError({
      code: "STUDENT_REVIEW_UPDATE_FORBIDDEN",
      message: "You cannot edit this review.",
      status: 403,
    });
  }

  const data: {
    title?: string | null;
    note?: string;
    visibility?: string;
    status?: string;
  } = {};

  if (hasTitle) {
    const t = parseTitle(b.title);
    if (t === undefined) {
      return apiError({
        code: "STUDENT_REVIEW_BAD_REQUEST",
        message: "title must be a string or null.",
        status: 400,
      });
    }
    data.title = t ?? null;
  }

  if (hasNote) {
    const n = parseNote(b.note);
    if (n === undefined) {
      return apiError({
        code: "STUDENT_REVIEW_BAD_REQUEST",
        message: "note must be a string or null.",
        status: 400,
      });
    }
    if (n === null) {
      return apiError({
        code: "STUDENT_REVIEW_BAD_REQUEST",
        message: "note cannot be empty.",
        status: 400,
      });
    }
    data.note = n;
  }

  if (hasVisibility) {
    const v = parseStudentReviewVisibility(b.visibility);
    if (!v) {
      return apiError({
        code: "STUDENT_REVIEW_BAD_REQUEST",
        message: "visibility must be INTERNAL or PARENT_VISIBLE.",
        status: 400,
      });
    }
    data.visibility = v;
  }

  if (hasStatus) {
    const s = parseStudentReviewStatus(b.status);
    if (!s) {
      return apiError({
        code: "STUDENT_REVIEW_BAD_REQUEST",
        message: "status must be DRAFT or PUBLISHED.",
        status: 400,
      });
    }
    if (!canSetStudentReviewStatus(user, s)) {
      return apiError({
        code: "STUDENT_REVIEW_STATUS_FORBIDDEN",
        message: "You cannot set this status.",
        status: 403,
      });
    }
    data.status = s;
  }

  try {
    const row = await prisma.studentReview.update({
      where: { id: reviewId.trim() },
      data,
      include: studentReviewListInclude,
    });

    return NextResponse.json({ ok: true, review: serializeStudentReview(row) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return apiError({
        code: "STUDENT_REVIEW_NOT_FOUND",
        message:
          "This review no longer exists or was removed. Refresh the student profile and try again.",
        status: 404,
      });
    }
    logError("student_review.patch_failed", logCtx, e, {
      reviewId: reviewId.trim(),
      studentId: existing.studentId,
    });
    return apiError({
      code: "STUDENT_REVIEW_UPDATE_FAILED",
      message: prismaErrorUserMessage(e, "Failed to update review."),
      status: 500,
    });
  }
}
