import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import type { AttendanceMarkStatus } from "@/lib/attendance-status";
import {
  ATTENDANCE_STATUSES_COUNTED_AS_ATTENDED_FOR_RATE,
  parseAttendanceMarkStatus,
} from "@/lib/attendance-status";
import { assistantAttendanceEditDeniedReason } from "@/lib/attendance-rules";
import {
  buildAttendanceScopeWhere,
  buildStudentScopeWhere,
} from "@/lib/authz-prisma-scopes";
import { assertBatchHasBranchId } from "@/lib/write-scope-validation";
import { canAccessBatch } from "@/lib/scope";
import {
  attendanceRecordOperationallyVisible,
  type AttendanceGuardrailRow,
} from "@/lib/tenant-integrity-guardrails";
import { ROLE_ADMIN } from "@/lib/roles";
import { formatCalendarYmdShortWeekday, getIndiaLastNCalendarDaysYmd } from "@/lib/datetime-india";

export type AttendanceStatusValue = AttendanceMarkStatus;

/** @deprecated Use parseAttendanceMarkStatus */
export function parseAttendanceStatusStrict(value: unknown): AttendanceMarkStatus | null {
  return parseAttendanceMarkStatus(value);
}

/** Raw rows for a batch/day (institute only). Prefer {@link getAttendanceForBatchDateScoped} from APIs. */
export async function getAttendanceForBatchDate(
  batchId: string,
  dateYmd: string,
  instituteId: string,
) {
  return prisma.attendance.findMany({
    where: { batchId, date: dateYmd, instituteId },
    select: { studentId: true, status: true },
  });
}

/** Attendance marks for a batch/day intersected with the caller's attendance scope (read/write parity). */
export async function getAttendanceForBatchDateScoped(
  user: SessionUserWithInstitute,
  batchId: string,
  dateYmd: string,
) {
  const scope = await buildAttendanceScopeWhere(user);
  const raw = await prisma.attendance.findMany({
    where: {
      batchId,
      date: dateYmd,
      AND: [scope],
    },
    select: {
      studentId: true,
      status: true,
      instituteId: true,
      batchId: true,
      student: {
        select: {
          instituteId: true,
          batchId: true,
          batch: {
            select: {
              instituteId: true,
              branchId: true,
              branch: { select: { instituteId: true } },
            },
          },
        },
      },
      batch: {
        select: {
          instituteId: true,
          branchId: true,
          branch: { select: { instituteId: true } },
        },
      },
    },
  });
  return raw
    .filter((r) => attendanceRecordOperationallyVisible(r as AttendanceGuardrailRow))
    .map((r) => ({ studentId: r.studentId, status: r.status }));
}

/**
 * Upsert rows; only for students currently assigned to this batch (validated).
 * Records audit metadata for Assistant Coach edits (and first submit).
 */
export async function saveAttendanceBulk(input: {
  batchId: string;
  dateYmd: string;
  instituteId: string;
  entries: { studentId: string; status: AttendanceMarkStatus }[];
  actorUserId: string;
  /** When set, enforces India-calendar 7-day edit window for this save. */
  enforceAssistantEditWindow?: { todayYmd: string };
  /** When set, re-validates batch access at the mutation layer (defense in depth). */
  caller?: SessionUserWithInstitute;
}) {
  if (input.caller) {
    if (input.caller.instituteId !== input.instituteId) {
      return { ok: false as const, error: "Batch not found." };
    }
    const batchOk = await canAccessBatch(input.caller, input.batchId);
    if (!batchOk) {
      return { ok: false as const, error: "Batch not found." };
    }
  }

  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    select: { id: true, instituteId: true, branchId: true },
  });
  if (!batch) {
    return { ok: false as const, error: "Batch not found." };
  }
  if (batch.instituteId == null || batch.instituteId !== input.instituteId) {
    return { ok: false as const, error: "Batch not found." };
  }
  const branchOk = assertBatchHasBranchId(batch.branchId);
  if (!branchOk.ok) {
    return { ok: false as const, error: branchOk.error };
  }

  const studentIds = [...new Set(input.entries.map((e) => e.studentId))];
  if (studentIds.length === 0) {
    return { ok: false as const, error: "No attendance entries." };
  }

  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      batchId: input.batchId,
      instituteId: input.instituteId,
    },
    select: { id: true },
  });
  const allowed = new Set(students.map((s) => s.id));
  for (const e of input.entries) {
    if (!allowed.has(e.studentId)) {
      return {
        ok: false as const,
        error: "One or more students are not in this batch.",
      };
    }
  }

  if (input.enforceAssistantEditWindow) {
    const msg = assistantAttendanceEditDeniedReason(
      input.dateYmd,
      input.enforceAssistantEditWindow.todayYmd,
    );
    if (msg) {
      return { ok: false as const, error: msg };
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const e of input.entries) {
      const existing = await tx.attendance.findUnique({
        where: {
          studentId_batchId_date: {
            studentId: e.studentId,
            batchId: input.batchId,
            date: input.dateYmd,
          },
        },
      });
      if (existing) {
        // First-submit metadata (submittedAt, submittedByUserId) stays immutable.
        await tx.attendance.update({
          where: { id: existing.id },
          data: {
            status: e.status,
            lastEditedByUserId: input.actorUserId,
            lastEditedAt: new Date(),
            editCount: { increment: 1 },
          },
        });
      } else {
        const now = new Date();
        await tx.attendance.create({
          data: {
            studentId: e.studentId,
            batchId: input.batchId,
            instituteId: batch.instituteId,
            date: input.dateYmd,
            status: e.status,
            submittedByUserId: input.actorUserId,
            submittedAt: now,
            editCount: 0,
          },
        });
      }
    }
  });

  return { ok: true as const };
}

/** Strict on-time present only — excludes LATE. */
export async function countPresentForBatchDate(batchId: string, dateYmd: string) {
  return prisma.attendance.count({
    where: { batchId, date: dateYmd, status: "PRESENT" },
  });
}

/**
 * Today-style attendance rate: present-like marks ÷ active students in a batch, both restricted
 * to the same student + attendance scope as mutations (admin = institute; head = branch; assistant = assigned batches).
 */
export async function getTodayAttendanceRatePercentScoped(
  user: SessionUserWithInstitute,
  dateYmd: string,
): Promise<number | null> {
  const studentBase = await buildStudentScopeWhere(user);
  const studentDen: Prisma.StudentWhereInput = {
    AND: [studentBase, { status: "ACTIVE", batchId: { not: null } }],
  };

  const inBatch = await prisma.student.count({ where: studentDen });
  if (inBatch === 0) return null;

  const attendanceScope = await buildAttendanceScopeWhere(user);
  const present = await prisma.attendance.count({
    where: {
      AND: [
        attendanceScope,
        { date: dateYmd, status: { in: [...ATTENDANCE_STATUSES_COUNTED_AS_ATTENDED_FOR_RATE] } },
        { student: studentDen },
      ],
    },
  });

  return Math.round((present / inBatch) * 1000) / 10;
}

/** Institute-wide admin KPI — implemented via {@link getTodayAttendanceRatePercentScoped} (admin scope). */
export async function getTodayAttendanceRatePercent(
  dateYmd: string,
  instituteId: string,
): Promise<number | null> {
  return getTodayAttendanceRatePercentScoped(
    {
      id: instituteId,
      role: ROLE_ADMIN,
      branchId: null,
      instituteId,
    },
    dateYmd,
  );
}

/**
 * Last 7 India calendar days (oldest → newest), same rate definition as {@link getTodayAttendanceRatePercent}
 * (active students in any batch; present-like marks / that cohort).
 */
export type AttendanceTrendSeriesPoint = { label: string; valuePct: number };

export async function getAttendanceTrendLast7DaysForUser(
  user: SessionUserWithInstitute,
  now: Date = new Date(),
): Promise<{ series: AttendanceTrendSeriesPoint[]; loadFailed: boolean }> {
  const days = getIndiaLastNCalendarDaysYmd(now, 7);
  if (days.length === 0) {
    return { series: [], loadFailed: false };
  }
  try {
    const rates = await Promise.all(
      days.map(async (ymd) => ({
        ymd,
        pct: await getTodayAttendanceRatePercentScoped(user, ymd),
      })),
    );
    const chronological = [...rates].reverse();
    const series: AttendanceTrendSeriesPoint[] = [];
    for (const { ymd, pct } of chronological) {
      if (pct === null) continue;
      series.push({
        label: formatCalendarYmdShortWeekday(ymd),
        valuePct: pct,
      });
    }
    return { series, loadFailed: false };
  } catch {
    return { series: [], loadFailed: true };
  }
}

/** Admin institute trend — delegates to {@link getAttendanceTrendLast7DaysForUser} with admin scope. */
export async function getAttendanceTrendLast7DaysForInstitute(
  instituteId: string,
  now: Date = new Date(),
): Promise<{ series: AttendanceTrendSeriesPoint[]; loadFailed: boolean }> {
  return getAttendanceTrendLast7DaysForUser(
    { id: instituteId, role: ROLE_ADMIN, branchId: null, instituteId },
    now,
  );
}
