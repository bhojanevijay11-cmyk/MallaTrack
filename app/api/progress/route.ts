import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { assertStudentForProgress } from "@/lib/authz-assertions";
import { parseCalendarDateYmd } from "@/lib/datetime-india";
import { baseCtxFromRequest, logError } from "@/lib/server-log";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";
import { assertBatchHasBranchId } from "@/lib/write-scope-validation";

export const runtime = "nodejs";

const ROUTE = "/api/progress";

const PROGRESS_ROLES = [ROLE_ADMIN, ROLE_HEAD_COACH, ROLE_ASSISTANT_COACH] as const;

function clampScore(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 1 || r > 10) return null;
  return r;
}

function entryPayload(e: {
  id: string;
  sessionDate: string;
  technicalScore: number | null;
  tacticalScore: number | null;
  physicalScore: number | null;
  mentalScore: number | null;
  disciplineScore: number | null;
  remarks: string | null;
  targetTierLabel: string | null;
  updatedAt: Date;
}) {
  return {
    id: e.id,
    sessionDate: e.sessionDate,
    technicalScore: e.technicalScore,
    tacticalScore: e.tacticalScore,
    physicalScore: e.physicalScore,
    mentalScore: e.mentalScore,
    disciplineScore: e.disciplineScore,
    remarks: e.remarks,
    targetTierLabel: e.targetTierLabel,
    updatedAt: e.updatedAt.toISOString(),
  };
}

/** GET ?studentId= — latest + recent entries for sidebar (role-scoped). */
export async function GET(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, PROGRESS_ROLES);
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId")?.trim() ?? "";
  if (!studentId) {
    return apiError({ code: "PROGRESS_LIST_BAD_REQUEST", message: "Missing studentId.", status: 400 });
  }

  const denied = await assertStudentForProgress(user, studentId);
  if (denied) return denied;

  let recent;
  try {
    recent = await prisma.studentProgressEntry.findMany({
      where: { studentId, instituteId: user.instituteId },
      orderBy: { sessionDate: "desc" },
      take: 8,
    });
  } catch (e) {
    logError("progress.list_failed", logCtx, e, { studentId });
    throw e;
  }

  const latest = recent[0] ?? null;
  return NextResponse.json({
    ok: true,
    latest: latest ? entryPayload(latest) : null,
    recent: recent.map(entryPayload),
  });
}

/** POST — upsert one row per (studentId, sessionDate). */
export async function POST(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, PROGRESS_ROLES);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return apiError({
      code: "PROGRESS_CREATE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }
  const b = body as Record<string, unknown>;
  const studentId = typeof b.studentId === "string" ? b.studentId.trim() : "";
  const dateRaw = typeof b.sessionDate === "string" ? b.sessionDate.trim() : "";
  const sessionDate = parseCalendarDateYmd(dateRaw) ?? "";
  const remarks = typeof b.remarks === "string" ? b.remarks.trim().slice(0, 4000) : "";
  const targetTierLabel =
    typeof b.targetTierLabel === "string" ? b.targetTierLabel.trim().slice(0, 120) : "";

  if (!studentId) {
    return apiError({ code: "PROGRESS_CREATE_BAD_REQUEST", message: "Missing studentId.", status: 400 });
  }
  if (!sessionDate) {
    return apiError({
      code: "PROGRESS_CREATE_BAD_REQUEST",
      message: "Invalid sessionDate.",
      status: 400,
    });
  }

  const deniedProgress = await assertStudentForProgress(
    user,
    studentId,
    "You cannot record progress for this student.",
  );
  if (deniedProgress) return deniedProgress;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { instituteId: true, batchId: true },
  });
  if (!student || student.instituteId !== user.instituteId) {
    return apiError({ code: "PROGRESS_STUDENT_NOT_FOUND", message: "Student not found.", status: 404 });
  }
  if (!student.batchId) {
    return apiError({
      code: "PROGRESS_CREATE_BAD_REQUEST",
      message: "Assign this student to a batch before recording session progress.",
      status: 400,
    });
  }
  const rosterBatch = await prisma.batch.findFirst({
    where: { id: student.batchId, instituteId: user.instituteId },
    select: { branchId: true },
  });
  if (!rosterBatch) {
    return apiError({ code: "PROGRESS_BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
  }
  const branchGate = assertBatchHasBranchId(rosterBatch.branchId);
  if (!branchGate.ok) {
    return apiError({
      code: "PROGRESS_CREATE_BAD_REQUEST",
      message: branchGate.error,
      status: 400,
    });
  }

  const technicalScore = clampScore(b.technicalScore);
  const tacticalScore = clampScore(b.tacticalScore);
  const physicalScore = clampScore(b.physicalScore);
  const mentalScore = clampScore(b.mentalScore);
  const disciplineScore = clampScore(b.disciplineScore);

  const instituteId = user.instituteId;

  let row;
  try {
    row = await prisma.studentProgressEntry.upsert({
      where: {
        studentId_sessionDate: { studentId, sessionDate },
      },
      create: {
        studentId,
        instituteId,
        sessionDate,
        technicalScore,
        tacticalScore,
        physicalScore,
        mentalScore,
        disciplineScore,
        remarks: remarks || null,
        targetTierLabel: targetTierLabel || null,
        createdByUserId: user.id,
      },
      update: {
        technicalScore,
        tacticalScore,
        physicalScore,
        mentalScore,
        disciplineScore,
        remarks: remarks || null,
        targetTierLabel: targetTierLabel || null,
        createdByUserId: user.id,
      },
    });
  } catch (e) {
    logError("progress.create_failed", logCtx, e, { studentId, instituteId });
    throw e;
  }

  return NextResponse.json({ ok: true, entry: entryPayload(row) }, { status: 200 });
}
