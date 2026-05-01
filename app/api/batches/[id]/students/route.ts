import { NextResponse } from "next/server";
import {
  getBatchByIdWithStudentsForUser,
  toBatchApiRecordWithHeadCoach,
} from "@/lib/batches-queries";
import { apiError } from "@/lib/api-response";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { verifyStudentIdsAssignableToBatch } from "@/lib/batch-roster-authorization";
import { prisma } from "@/lib/prisma";
import { baseCtxFromRequest, logError } from "@/lib/server-log";
import { APP_ADMIN_HEAD_ROLES } from "@/lib/roles";

export const runtime = "nodejs";

const ROUTE = "/api/batches/[id]/students";

/**
 * Assign multiple students to this batch in one request (replaces their batchId with this batch).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id: batchId } = await params;

  if (!batchId) {
    return apiError({ code: "BATCH_ID_REQUIRED", message: "Batch id is required.", status: 400 });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_ADMIN_HEAD_ROLES);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({
      code: "BATCH_STUDENT_ASSIGN_BAD_REQUEST",
      message: "Invalid JSON body.",
      status: 400,
    });
  }

  if (!body || typeof body !== "object") {
    return apiError({
      code: "BATCH_STUDENT_ASSIGN_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }

  const b = body as Record<string, unknown>;
  const rawIds = b.studentIds;
  if (!Array.isArray(rawIds) || !rawIds.every((x) => typeof x === "string")) {
    return apiError({
      code: "BATCH_STUDENT_ASSIGN_BAD_REQUEST",
      message: "studentIds must be an array of strings.",
      status: 400,
    });
  }

  const studentIds = rawIds.map((id) => id.trim()).filter(Boolean);
  if (studentIds.length === 0) {
    return apiError({
      code: "BATCH_STUDENT_ASSIGN_BAD_REQUEST",
      message: "studentIds must contain at least one id.",
      status: 400,
    });
  }

  const gate = await verifyStudentIdsAssignableToBatch(user, batchId, studentIds);
  if (!gate.ok) {
    const gateCode =
      gate.status === 404 ? "BATCH_NOT_FOUND" : "BATCH_STUDENT_ASSIGN_BAD_REQUEST";
    return apiError({ code: gateCode, message: gate.error, status: gate.status });
  }

  try {
    const batch = await prisma.batch.findFirst({
      where: { id: batchId, instituteId: user.instituteId },
      select: { id: true, instituteId: true },
    });
    if (!batch?.instituteId) {
      return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
    }

    const instituteId = batch.instituteId;

    await prisma.$transaction(
      studentIds.map((studentId) =>
        prisma.student.update({
          where: { id: studentId },
          data: { batchId, instituteId },
        }),
      ),
    );

    const updated = await getBatchByIdWithStudentsForUser(user, batchId);
    if (!updated) {
      return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
    }

    const batchRecord = await toBatchApiRecordWithHeadCoach(updated);
    return NextResponse.json(
      {
        ok: true,
        batch: {
          ...batchRecord,
          students: updated.students,
        },
      },
      { status: 200 },
    );
  } catch (e) {
    logError("batches.students.assign_failed", logCtx, e, { batchId });
    return apiError({
      code: "BATCH_STUDENT_ASSIGN_FAILED",
      message: "Failed to assign students (check ids exist).",
      status: 500,
    });
  }
}
