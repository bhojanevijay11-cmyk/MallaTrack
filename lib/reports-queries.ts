import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import {
  buildAttendanceScopeWhere,
  buildBatchScopeWhere,
  buildStudentScopeWhere,
} from "@/lib/authz-prisma-scopes";
import {
  ATTENDANCE_STATUSES_COUNTED_AS_ATTENDED_FOR_RATE,
  isAbsentStatus,
  isAttendancePresentLike,
  parseAttendanceMarkStatus,
} from "@/lib/attendance-status";
import { resolveBranchHeadCoachLabels } from "@/lib/branch-head-coach";
import { ROLE_ADMIN } from "@/lib/roles";
import { staffUserLabel } from "@/lib/staff-user-label";

export type BatchReportRow = {
  batchId: string;
  batchName: string | null;
  batchStatus: string;
  studentCount: number;
  /** Optional legacy Coach table row linked to the batch (directory), not User roles. */
  legacyCoachDirectoryName: string | null;
  /** Head coach user(s) for the batch branch, when resolvable. */
  branchHeadCoachSummary: string | null;
  /** Assigned assistant coach user labels. */
  assistantCoachSummary: string | null;
  /** PRESENT + LATE — numerator for `attendanceRatePct` only; not strict "present". */
  presentCount: number;
  absentCount: number;
  unmarkedCount: number;
  attendanceRatePct: number | null;
};

/**
 * Operational reports for the signed-in user — same batch/student/attendance scope as list APIs
 * ({@link buildBatchScopeWhere}, {@link buildStudentScopeWhere}, {@link buildAttendanceScopeWhere}).
 * Today used from the admin Reports page only; builders keep parity if additional roles gain access.
 */
export async function getReportsSnapshotForUser(
  user: SessionUserWithInstitute,
  dateYmd: string,
) {
  const [batchScope, studentScope, attendanceScope] = await Promise.all([
    buildBatchScopeWhere(user),
    buildStudentScopeWhere(user),
    buildAttendanceScopeWhere(user),
  ]);

  const activeStudentWhere: Prisma.StudentWhereInput = {
    AND: [studentScope, { status: "ACTIVE" }],
  };
  const activeStudentInBatchWhere: Prisma.StudentWhereInput = {
    AND: [studentScope, { status: "ACTIVE", batchId: { not: null } }],
  };

  const [totalStudents, totalActiveBatches, totalActiveCoaches, batches] =
    await Promise.all([
      prisma.student.count({ where: activeStudentWhere }),
      prisma.batch.count({
        where: { AND: [batchScope, { status: "ACTIVE" }] },
      }),
      prisma.coach.count({
        where: { status: "ACTIVE", instituteId: user.instituteId },
      }),
      prisma.batch.findMany({
        where: batchScope,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { students: true } },
          coach: { select: { fullName: true } },
          assistantAssignments: {
            include: {
              user: {
                select: {
                  email: true,
                  invitesReceived: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { fullName: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

  const attendanceRows = await prisma.attendance.groupBy({
    by: ["batchId", "status"],
    where: {
      AND: [attendanceScope, { date: dateYmd }],
    },
    _count: { _all: true },
  });

  const byBatch = new Map<
    string,
    { attendedForRate: number; absent: number; other: number }
  >();
  for (const row of attendanceRows) {
    const cur = byBatch.get(row.batchId) ?? {
      attendedForRate: 0,
      absent: 0,
      other: 0,
    };
    const n = row._count._all;
    const parsed = parseAttendanceMarkStatus(row.status);
    if (parsed && isAttendancePresentLike(parsed)) cur.attendedForRate += n;
    else if (parsed && isAbsentStatus(parsed)) cur.absent += n;
    else cur.other += n;
    byBatch.set(row.batchId, cur);
  }

  const headMap = await resolveBranchHeadCoachLabels(
    user.instituteId,
    batches.map((b) => b.branchId),
  );

  const batchRows: BatchReportRow[] = batches.map((b) => {
    const sc = b._count.students;
    const att = byBatch.get(b.id) ?? {
      attendedForRate: 0,
      absent: 0,
      other: 0,
    };
    const marked = att.attendedForRate + att.absent + att.other;
    const unmarked = Math.max(0, sc - marked);
    let attendanceRatePct: number | null = null;
    if (sc > 0) {
      attendanceRatePct = Math.round((att.attendedForRate / sc) * 1000) / 10;
    }
    const assistantCoachSummary =
      b.assistantAssignments.length > 0
        ? b.assistantAssignments.map((a) => staffUserLabel(a.user)).join(" · ")
        : null;
    const branchHeadCoachSummary = b.branchId ? headMap.get(b.branchId) ?? null : null;
    return {
      batchId: b.id,
      batchName: b.name,
      batchStatus: b.status,
      studentCount: sc,
      legacyCoachDirectoryName: b.coach?.fullName?.trim() ? b.coach.fullName.trim() : null,
      branchHeadCoachSummary,
      assistantCoachSummary,
      presentCount: att.attendedForRate,
      absentCount: att.absent,
      unmarkedCount: unmarked,
      attendanceRatePct,
    };
  });

  /** Last 7 calendar days including dateYmd: total present / total slot (students in batch per day summed). */
  const recentDays = expandRecentCalendarDays(dateYmd, 7);
  const recentAgg = await Promise.all(
    recentDays.map(async (d) => {
      const attendedForRate = await prisma.attendance.count({
        where: {
          AND: [
            attendanceScope,
            {
              date: d,
              status: { in: [...ATTENDANCE_STATUSES_COUNTED_AS_ATTENDED_FOR_RATE] },
              student: activeStudentInBatchWhere,
            },
          ],
        },
      });
      const denom = await prisma.student.count({ where: activeStudentInBatchWhere });
      const pct =
        denom === 0
          ? null
          : Math.round((attendedForRate / denom) * 1000) / 10;
      return {
        date: d,
        presentCount: attendedForRate,
        denominator: denom,
        pct,
      };
    }),
  );

  return {
    dateYmd,
    totalStudents,
    totalActiveBatches,
    totalActiveCoaches,
    batchRows,
    recentAttendanceByDay: recentAgg,
  };
}

/** @deprecated Prefer {@link getReportsSnapshotForUser} — kept for callers that only have an institute id. */
export async function getReportsSnapshot(dateYmd: string, instituteId: string) {
  return getReportsSnapshotForUser(
    {
      id: "__reports_institute_only__",
      role: ROLE_ADMIN,
      branchId: null,
      instituteId,
    },
    dateYmd,
  );
}

function expandRecentCalendarDays(endYmd: string, count: number): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endYmd.trim());
  if (!m) return [endYmd];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(y, mo - 1, d - i));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    out.push(`${yy}-${mm}-${dd}`);
  }
  return out.reverse();
}

export type ReportsSnapshot = Awaited<ReturnType<typeof getReportsSnapshotForUser>>;
