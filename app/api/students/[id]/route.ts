import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import {
  getStudentByIdWithBatchForUser,
  setStudentBatchAssignment,
  studentBatchInclude,
} from "@/lib/students-queries";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { canAccessBatch } from "@/lib/scope";
import { studentPayloadForRole } from "@/lib/students-api";
import {
  APP_ADMIN_HEAD_ROLES,
  APP_STAFF_ROLES,
  ROLE_ADMIN,
} from "@/lib/roles";
import { validateParentUserIdForInstitute } from "@/lib/parent-user-validation";
import { assertBatchHasBranchId } from "@/lib/write-scope-validation";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/students/[id]";

function parseBatchIdField(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t === "" ? null : t;
  }
  return undefined;
}

function parseParentUserIdField(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t === "" ? null : t;
  }
  return undefined;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id: studentId } = await params;

  if (!studentId) {
    return apiError({
      code: "STUDENT_ID_REQUIRED",
      message: "Student id is required.",
      status: 400,
    });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_ADMIN_HEAD_ROLES);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }

  if (!body || typeof body !== "object") {
    return apiError({
      code: "STUDENT_UPDATE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }

  const b = body as Record<string, unknown>;
  const hasBatchId = "batchId" in b;
  const hasParentUserId = "parentUserId" in b;
  if (!hasBatchId && !hasParentUserId) {
    return apiError({
      code: "STUDENT_UPDATE_BAD_REQUEST",
      message: "Provide batchId and/or parentUserId.",
      status: 400,
    });
  }

  if (hasParentUserId && user.role !== ROLE_ADMIN) {
    return apiError({
      code: "STUDENT_UPDATE_PARENT_FORBIDDEN",
      message: "Only administrators can change the linked parent account.",
      status: 403,
    });
  }

  let batchId: string | null | undefined;
  if (hasBatchId) {
    batchId = parseBatchIdField(b.batchId);
    if (batchId === undefined) {
      return apiError({
        code: "STUDENT_UPDATE_BAD_REQUEST",
        message: "batchId must be a string, null, or empty string.",
        status: 400,
      });
    }
    if (batchId === null) {
      return apiError({
        code: "STUDENT_UPDATE_BAD_REQUEST",
        message: "Student must be assigned to a batch.",
        status: 400,
      });
    }
  }

  let parentUserId: string | null | undefined;
  if (hasParentUserId) {
    parentUserId = parseParentUserIdField(b.parentUserId);
    if (parentUserId === undefined) {
      return apiError({
        code: "STUDENT_UPDATE_BAD_REQUEST",
        message: "parentUserId must be a string, null, or empty string.",
        status: 400,
      });
    }
  }

  try {
    const existingStudent = await getStudentByIdWithBatchForUser(user, studentId);
    if (!existingStudent) {
      return apiError({
        code: "STUDENT_NOT_FOUND",
        message: "Student not found.",
        status: 404,
      });
    }

    if (hasBatchId && typeof batchId === "string") {
      const batch = await prisma.batch.findFirst({
        where: { id: batchId, instituteId: user.instituteId },
        select: { id: true, branchId: true },
      });
      if (!batch) {
        return apiError({
          code: "STUDENT_UPDATE_INVALID_BATCH",
          message: "Invalid batch for this institute.",
          status: 400,
        });
      }
      const canBatch = await canAccessBatch(user, batchId);
      if (!canBatch) {
        return apiError({
          code: "STUDENT_BATCH_NOT_FOUND",
          message: "Batch not found.",
          status: 404,
        });
      }
      const branchReq = assertBatchHasBranchId(batch.branchId);
      if (!branchReq.ok) {
        return apiError({
          code: "STUDENT_UPDATE_BAD_REQUEST",
          message: branchReq.error,
          status: 400,
        });
      }
    }

    if (hasParentUserId) {
      const check = await validateParentUserIdForInstitute(
        user.instituteId,
        parentUserId ?? null,
      );
      if (!check.ok) {
        return apiError({
          code: "STUDENT_UPDATE_BAD_REQUEST",
          message: check.message,
          status: 400,
        });
      }
    }

    if (hasBatchId && !hasParentUserId) {
      try {
        const student = await setStudentBatchAssignment(studentId, batchId!);
        const raw = { ...student } as Record<string, unknown>;
        return NextResponse.json(
          { ok: true, student: studentPayloadForRole(raw, user.role) },
          { status: 200 },
        );
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        if (code === "STUDENT_OR_BATCH_NOT_FOUND") {
          return apiError({
            code: "STUDENT_OR_BATCH_NOT_FOUND",
            message: "Student or batch not found.",
            status: 404,
          });
        }
        if (code === "STUDENT_BATCH_INSTITUTE_MISMATCH") {
          return apiError({
            code: "STUDENT_UPDATE_INVALID_BATCH",
            message: "Invalid batch for this institute.",
            status: 400,
          });
        }
        if (code === "BATCH_BRANCH_REQUIRED") {
          const br = assertBatchHasBranchId("");
          return apiError({
            code: "STUDENT_UPDATE_BAD_REQUEST",
            message: br.ok ? "Batch branch is required." : br.error,
            status: 400,
          });
        }
        throw err;
      }
    }

    if (!hasBatchId && hasParentUserId) {
      const student = await prisma.student.update({
        where: { id: studentId, instituteId: user.instituteId },
        data: { parentUserId: parentUserId ?? null },
        include: studentBatchInclude,
      });
      const raw = { ...student } as Record<string, unknown>;
      return NextResponse.json(
        { ok: true, student: studentPayloadForRole(raw, user.role) },
        { status: 200 },
      );
    }

    const nextBatchId = batchId!;

    const batchRow = await prisma.batch.findFirst({
      where: { id: nextBatchId, instituteId: user.instituteId },
      select: { id: true, instituteId: true, branchId: true },
    });
    if (!batchRow) {
      return apiError({
        code: "STUDENT_UPDATE_INVALID_BATCH",
        message: "Invalid batch for this institute.",
        status: 400,
      });
    }
    const branchReqCombined = assertBatchHasBranchId(batchRow.branchId);
    if (!branchReqCombined.ok) {
      return apiError({
        code: "STUDENT_UPDATE_BAD_REQUEST",
        message: branchReqCombined.error,
        status: 400,
      });
    }

    const student = await prisma.student.update({
      where: { id: studentId, instituteId: user.instituteId },
      data: {
        batchId: nextBatchId,
        instituteId: batchRow.instituteId,
        parentUserId: parentUserId ?? null,
      },
      include: studentBatchInclude,
    });
    const raw = { ...student } as Record<string, unknown>;
    return NextResponse.json(
      { ok: true, student: studentPayloadForRole(raw, user.role) },
      { status: 200 },
    );
  } catch (e) {
    logError("students.update_failed", logCtx, e);
    return apiError({
      code: "STUDENT_UPDATE_FAILED",
      message: "Failed to update student.",
      status: 500,
    });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id } = await params;

  if (!id) {
    return apiError({
      code: "STUDENT_ID_REQUIRED",
      message: "Student id is required.",
      status: 400,
    });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

  try {
    const student = await getStudentByIdWithBatchForUser(user, id);
    if (!student) {
      return apiError({
        code: "STUDENT_NOT_FOUND",
        message: "Student not found.",
        status: 404,
      });
    }
    const raw = { ...student } as Record<string, unknown>;
    return NextResponse.json(
      { ok: true, student: studentPayloadForRole(raw, user.role) },
      { status: 200 },
    );
  } catch (e) {
    logError("students.get_failed", logCtx, e);
    return apiError({
      code: "STUDENT_FETCH_FAILED",
      message: "Failed to fetch student.",
      status: 500,
    });
  }
}
