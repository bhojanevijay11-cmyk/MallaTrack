import { NextResponse } from "next/server";
import {
  getAttendanceForBatchDateScoped,
} from "@/lib/attendance-queries";
import { parseCalendarDateYmd } from "@/lib/datetime-india";
import { prisma } from "@/lib/prisma";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { assertAttendanceAccess } from "@/lib/authz-assertions";
import { buildStudentScopeWhere } from "@/lib/authz-prisma-scopes";
import { APP_STAFF_ROLES } from "@/lib/roles";
import { normalizeStoredAttendanceStatus } from "@/lib/attendance-status";
import { submitAttendancePayload } from "@/lib/attendance-submit";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const batchId = url.searchParams.get("batchId")?.trim() ?? "";
  const dateRaw = url.searchParams.get("date");
  const dateYmd = parseCalendarDateYmd(dateRaw);

  if (!batchId) {
    return apiError({
      code: "MISSING_BATCH_ID",
      message: "Query parameter batchId is required.",
      status: 400,
    });
  }
  if (!dateYmd) {
    return apiError({
      code: "INVALID_DATE",
      message: "Query parameter date (YYYY-MM-DD) is required.",
      status: 400,
    });
  }

  const deniedBatch = await assertAttendanceAccess(user, batchId);
  if (deniedBatch) return deniedBatch;

  try {
    const batch = await prisma.batch.findFirst({
      where: { id: batchId, instituteId: user.instituteId },
      select: { id: true },
    });
    if (!batch) {
      return apiError({
        code: "BATCH_NOT_FOUND",
        message: "Batch not found.",
        status: 404,
      });
    }

    const studentScope = await buildStudentScopeWhere(user);
    const students = await prisma.student.findMany({
      where: {
        AND: [studentScope, { batchId, status: "ACTIVE" }],
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, gender: true },
    });

    const records = await getAttendanceForBatchDateScoped(user, batchId, dateYmd);
    const map = new Map(records.map((r) => [r.studentId, r.status]));

    const rows = students.map((s) => {
      const raw = map.get(s.id);
      const st = normalizeStoredAttendanceStatus(raw);
      return {
        id: s.id,
        fullName: s.fullName,
        gender: s.gender,
        status: st,
      };
    });

    return NextResponse.json(
      { ok: true, batchId, date: dateYmd, students: rows },
      { status: 200 },
    );
  } catch {
    return apiError({
      code: "ATTENDANCE_LOAD_FAILED",
      message: "Failed to load attendance.",
      status: 500,
    });
  }
}

export async function PUT(req: Request) {
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

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

  const result = await submitAttendancePayload(user, body);
  if (!result.ok) {
    return apiError({
      code: "ATTENDANCE_SUBMIT_FAILED",
      message: result.error,
      status: result.status,
    });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
