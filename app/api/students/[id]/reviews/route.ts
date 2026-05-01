import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { getStudentByIdWithBatchForUser } from "@/lib/students-queries";
import { APP_STAFF_ROLES, ROLE_PARENT } from "@/lib/roles";
import {
  parseStudentReviewVisibility,
  STUDENT_REVIEW_STATUS,
  STUDENT_REVIEW_VISIBILITY,
  type StudentReviewVisibility,
} from "@/lib/student-review-constants";
import {
  serializeStudentReview,
  studentReviewListInclude,
} from "@/lib/student-review-payload";
import { buildStudentReviewListWhere } from "@/lib/student-review-scope";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/students/[id]/reviews";

const GET_ROLES = [...APP_STAFF_ROLES, ROLE_PARENT] as const;

function parseTitle(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t === "" ? null : t;
}

function parseNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id: studentId } = await params;
  if (!studentId) {
    return apiError({
      code: "STUDENT_REVIEW_BAD_REQUEST",
      message: "Student id is required.",
      status: 400,
    });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, GET_ROLES);
  if (user instanceof NextResponse) return user;

  const student = await getStudentByIdWithBatchForUser(user, studentId);
  if (!student) {
    return apiError({ code: "STUDENT_REVIEWS_NOT_FOUND", message: "Not found.", status: 404 });
  }

  try {
    /** Scope matches Student 360 / roster: parents only published parent-facing; staff only when student is in their scope. */
    const where = await buildStudentReviewListWhere(user, studentId);
    const rows = await prisma.studentReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: studentReviewListInclude,
    });

    return NextResponse.json({
      ok: true,
      reviews: rows.map(serializeStudentReview),
    });
  } catch (e) {
    logError("students.reviews.list_failed", logCtx, e, { studentId });
    return apiError({
      code: "STUDENT_REVIEWS_LIST_FAILED",
      message: "Failed to load reviews.",
      status: 500,
    });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id: studentId } = await params;
  if (!studentId) {
    return apiError({
      code: "STUDENT_REVIEW_BAD_REQUEST",
      message: "Student id is required.",
      status: 400,
    });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

  const studentInScope = await getStudentByIdWithBatchForUser(user, studentId);
  if (!studentInScope) {
    return apiError({ code: "STUDENT_REVIEWS_NOT_FOUND", message: "Not found.", status: 404 });
  }

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

  const note = parseNote(b.note);
  if (!note) {
    return apiError({
      code: "STUDENT_REVIEW_BAD_REQUEST",
      message: "note is required and must be non-empty.",
      status: 400,
    });
  }

  let title: string | null = null;
  if ("title" in b) {
    const t = parseTitle(b.title);
    if (t === undefined) {
      return apiError({
        code: "STUDENT_REVIEW_BAD_REQUEST",
        message: "title must be a string or null.",
        status: 400,
      });
    }
    title = t ?? null;
  }

  let visibility: StudentReviewVisibility = STUDENT_REVIEW_VISIBILITY.INTERNAL;
  if (b.visibility !== undefined) {
    const v = parseStudentReviewVisibility(b.visibility);
    if (!v) {
      return apiError({
        code: "STUDENT_REVIEW_BAD_REQUEST",
        message: "visibility must be INTERNAL or PARENT_VISIBLE.",
        status: 400,
      });
    }
    visibility = v;
  }

  try {
    const row = await prisma.studentReview.create({
      data: {
        studentId,
        instituteId: user.instituteId,
        authorUserId: user.id,
        authorRole: user.role,
        title,
        note,
        visibility,
        status: STUDENT_REVIEW_STATUS.DRAFT,
      },
      include: studentReviewListInclude,
    });

    return NextResponse.json(
      { ok: true, review: serializeStudentReview(row) },
      { status: 201 },
    );
  } catch (e) {
    logError("students.reviews.create_failed", logCtx, e, { studentId });
    return apiError({
      code: "STUDENT_REVIEW_CREATE_FAILED",
      message: "Failed to create review.",
      status: 500,
    });
  }
}
