import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { INSTITUTE_REQUIRED_MESSAGE } from "@/lib/auth-server";
import { canMutateAttendance } from "@/lib/authz-roles";
import { saveAttendanceBulk } from "@/lib/attendance-queries";
import { getIndiaTodayCalendarYmd, parseCalendarDateYmd } from "@/lib/datetime-india";
import { canAccessBatch } from "@/lib/scope";
import { parseAttendanceMarkStatus } from "@/lib/attendance-status";
import type { AttendanceMarkStatus } from "@/lib/attendance-status";
import { ROLE_ASSISTANT_COACH } from "@/lib/roles";

export type AttendanceSubmitResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

/**
 * Shared bulk submit for PUT /api/attendance and POST /api/attendance/submit.
 * `records` or `entries` array of { studentId, status }.
 */
export async function submitAttendancePayload(
  user: SessionUserWithInstitute,
  body: unknown,
): Promise<AttendanceSubmitResult> {
  if (!canMutateAttendance(user.role)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body.", status: 400 };
  }

  const b = body as Record<string, unknown>;
  const batchId = typeof b.batchId === "string" ? b.batchId.trim() : "";
  const dateYmd = parseCalendarDateYmd(b.date);

  if (!batchId) {
    return { ok: false, error: "Field batchId is required.", status: 400 };
  }
  if (!dateYmd) {
    return { ok: false, error: "Field date (YYYY-MM-DD) is required.", status: 400 };
  }

  const rawList = b.records ?? b.entries;
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return {
      ok: false,
      error: "records (or entries) must be a non-empty array.",
      status: 400,
    };
  }

  const allowed = await canAccessBatch(user, batchId);
  if (!allowed) {
    return { ok: false, error: "Batch not found.", status: 404 };
  }
  const tenantId = user.instituteId;

  const entries: { studentId: string; status: AttendanceMarkStatus }[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Each record must be an object.", status: 400 };
    }
    const e = item as Record<string, unknown>;
    const studentId = typeof e.studentId === "string" ? e.studentId.trim() : "";
    const status = parseAttendanceMarkStatus(e.status);
    if (!studentId || !status) {
      return {
        ok: false,
        error: "Each record needs studentId and status (PRESENT, ABSENT, or LATE).",
        status: 400,
      };
    }
    entries.push({ studentId, status });
  }

  const todayYmd = getIndiaTodayCalendarYmd();
  const enforceAssistant =
    user.role === ROLE_ASSISTANT_COACH ? { todayYmd } : undefined;

  try {
    const result = await saveAttendanceBulk({
      batchId,
      dateYmd,
      instituteId: tenantId,
      entries,
      actorUserId: user.id,
      enforceAssistantEditWindow: enforceAssistant,
      caller: user,
    });
    if (!result.ok) {
      return { ok: false, error: result.error, status: 400 };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save attendance.", status: 500 };
  }
}
