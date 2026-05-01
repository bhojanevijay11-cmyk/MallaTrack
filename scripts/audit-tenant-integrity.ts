import "dotenv/config";

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

type Severity = "CRITICAL" | "HIGH" | "WARNING" | "INFO";

type Finding = {
  severity: Severity;
  code: string;
  title: string;
  description: string;
  count: number;
  sampleIds: string[];
};

const SAMPLE_LIMIT = 10;

function pad(n: number) {
  return String(n).padStart(6, " ");
}

function header(title: string) {
  console.log("");
  console.log("=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

function section(title: string) {
  console.log("");
  console.log("-".repeat(72));
  console.log(title);
  console.log("-".repeat(72));
}

function printFinding(f: Finding) {
  const sev = `[${f.severity}]`;
  console.log(`${sev} ${pad(f.count)}  ${f.code}  ${f.title}`);
  if (f.description) console.log(`      ${f.description}`);
  if (f.count > 0) {
    const samples = f.sampleIds.slice(0, SAMPLE_LIMIT);
    if (samples.length > 0) console.log(`      sampleIds: ${samples.join(", ")}`);
  }
}

async function safeConnect(): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    await prisma.$connect();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

async function rawCountAndSamples(sqlBase: Prisma.Sql): Promise<{ count: number; sampleIds: string[] }> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`${sqlBase} LIMIT ${SAMPLE_LIMIT}`,
  );
  const countRow = await prisma.$queryRaw<Array<{ count: number }>>(
    Prisma.sql`SELECT CAST(COUNT(*) AS INTEGER) as count FROM (${sqlBase}) AS t`,
  );
  return { count: countRow[0]?.count ?? 0, sampleIds: rows.map((r) => r.id) };
}

async function modelCountAndSamples<T extends { id: string }>(args: {
  model: {
    count: (a: any) => Promise<number>;
    findMany: (a: any) => Promise<T[]>;
  };
  where: unknown;
  select?: unknown;
  orderBy?: unknown;
}): Promise<{ count: number; sampleIds: string[] }> {
  const count = await args.model.count({ where: args.where });
  const rows = await args.model.findMany({
    where: args.where,
    select: args.select ?? { id: true },
    orderBy: args.orderBy ?? { createdAt: "asc" },
    take: SAMPLE_LIMIT,
  });
  return { count, sampleIds: rows.map((r) => r.id) };
}

async function run() {
  header("MallaTrack — Tenant Integrity Audit (READ ONLY)");
  console.log(`DB: ${process.env.DATABASE_URL ? "DATABASE_URL is set" : "DATABASE_URL is NOT set"}`);

  const conn = await safeConnect();
  if (!conn.ok) {
    console.log("");
    console.log("[CRITICAL] Unable to connect to database.");
    console.log("          Ensure DATABASE_URL points to a reachable DB.");
    const msg = String((conn.error as any)?.message ?? conn.error);
    console.log(`          Error: ${msg}`);
    if (msg.includes("Error validating datasource") && msg.includes("protocol `postgresql://`")) {
      console.log("");
      console.log(
        "          Hint: your generated Prisma Client currently expects Postgres, but DATABASE_URL looks non-Postgres.",
      );
      console.log("          - For SQLite dev: run `npm run build` or `npx prisma generate` (SQLite schema).");
      console.log("          - For Postgres: set DATABASE_URL to `postgresql://...` and run `npm run generate:pg`.");
    }
    process.exitCode = 2;
    return;
  }

  const findings: Finding[] = [];

  section("NULL tenant ownership (instituteId)");
  {
    // Note: User.instituteId is intentionally nullable for platform SUPER_ADMIN.
    const branchNull = await modelCountAndSamples({ model: prisma.branch, where: { instituteId: null } });
    findings.push({
      severity: branchNull.count > 0 ? "HIGH" : "INFO",
      code: "BRANCH_NULL_INSTITUTE",
      title: "Branch rows with instituteId = null",
      description: "Tenant-owned branches should usually have an instituteId.",
      ...branchNull,
    });

    const userNull = await modelCountAndSamples({ model: prisma.user, where: { instituteId: null } });
    findings.push({
      severity: userNull.count > 0 ? "WARNING" : "INFO",
      code: "USER_NULL_INSTITUTE",
      title: "User rows with instituteId = null",
      description:
        "May be valid for platform super_admin; for tenant roles this blocks future NOT NULL hardening.",
      ...userNull,
    });

    const studentNull = await modelCountAndSamples({ model: prisma.student, where: { instituteId: null } });
    findings.push({
      severity: studentNull.count > 0 ? "HIGH" : "INFO",
      code: "STUDENT_NULL_INSTITUTE",
      title: "Student rows with instituteId = null",
      description: "Students are tenant-owned; null instituteId is a future NOT NULL blocker.",
      ...studentNull,
    });

    const batchNull = await modelCountAndSamples({ model: prisma.batch, where: { instituteId: null } });
    findings.push({
      severity: batchNull.count > 0 ? "HIGH" : "INFO",
      code: "BATCH_NULL_INSTITUTE",
      title: "Batch rows with instituteId = null",
      description: "Batches are tenant-owned; null instituteId is a future NOT NULL blocker.",
      ...batchNull,
    });

    const coachNull = await modelCountAndSamples({ model: prisma.coach, where: { instituteId: null } });
    findings.push({
      severity: coachNull.count > 0 ? "HIGH" : "INFO",
      code: "COACH_NULL_INSTITUTE",
      title: "Coach rows with instituteId = null",
      description: "Coaches are tenant-owned; null instituteId is a future NOT NULL blocker.",
      ...coachNull,
    });

    const attendanceNull = await modelCountAndSamples({
      model: prisma.attendance,
      where: { instituteId: null },
      orderBy: { createdAt: "asc" },
    });
    findings.push({
      severity: attendanceNull.count > 0 ? "HIGH" : "INFO",
      code: "ATTENDANCE_NULL_INSTITUTE",
      title: "Attendance rows with instituteId = null",
      description: "Attendance should align to tenant; null instituteId is a future NOT NULL blocker.",
      ...attendanceNull,
    });
  }

  section("Legacy branch assignment gaps (branchId)");
  {
    const batchNullBranch = await modelCountAndSamples({ model: prisma.batch, where: { branchId: null } });
    findings.push({
      severity: batchNullBranch.count > 0 ? "WARNING" : "INFO",
      code: "BATCH_NULL_BRANCH",
      title: "Batch rows with branchId = null",
      description:
        "Batch.branchId is currently nullable (legacy). Hardening to NOT NULL requires resolving these.",
      ...batchNullBranch,
    });

    const userNullBranch = await modelCountAndSamples({ model: prisma.user, where: { branchId: null } });
    findings.push({
      severity: userNullBranch.count > 0 ? "INFO" : "INFO",
      code: "USER_NULL_BRANCH",
      title: "User rows with branchId = null",
      description:
        "May be valid depending on role (e.g. super_admin). For staff roles, null may be unexpected.",
      ...userNullBranch,
    });

    // Role-specific: head_coach missing branch is usually a problem.
    const headCoachNullBranch = await modelCountAndSamples({
      model: prisma.user,
      where: { role: "head_coach", branchId: null },
    });
    findings.push({
      severity: headCoachNullBranch.count > 0 ? "WARNING" : "INFO",
      code: "HEAD_COACH_NULL_BRANCH",
      title: "Head coach users with branchId = null",
      description: "Often indicates missing branch scoping for staff.",
      ...headCoachNullBranch,
    });
  }

  section("Orphan relationships (foreign keys pointing to missing rows)");
  {
    const checks: Array<{ severity: Severity; code: string; title: string; sql: Prisma.Sql }> = [
      {
        severity: "HIGH",
        code: "USER_ORPHAN_BRANCH",
        title: "User.branchId set but Branch missing",
        sql: Prisma.sql`
          SELECT u."id" as id
          FROM "User" u
          LEFT JOIN "Branch" b ON b."id" = u."branchId"
          WHERE u."branchId" IS NOT NULL AND b."id" IS NULL
        `,
      },
      {
        severity: "HIGH",
        code: "BATCH_ORPHAN_BRANCH",
        title: "Batch.branchId set but Branch missing",
        sql: Prisma.sql`
          SELECT ba."id" as id
          FROM "Batch" ba
          LEFT JOIN "Branch" b ON b."id" = ba."branchId"
          WHERE ba."branchId" IS NOT NULL AND b."id" IS NULL
        `,
      },
      {
        severity: "CRITICAL",
        code: "STUDENT_ORPHAN_BATCH",
        title: "Student.batchId set but Batch missing",
        sql: Prisma.sql`
          SELECT s."id" as id
          FROM "Student" s
          LEFT JOIN "Batch" ba ON ba."id" = s."batchId"
          WHERE s."batchId" IS NOT NULL AND ba."id" IS NULL
        `,
      },
      {
        severity: "CRITICAL",
        code: "ATTENDANCE_ORPHAN_STUDENT",
        title: "Attendance.studentId points to missing Student",
        sql: Prisma.sql`
          SELECT a."id" as id
          FROM "Attendance" a
          LEFT JOIN "Student" s ON s."id" = a."studentId"
          WHERE s."id" IS NULL
        `,
      },
      {
        severity: "CRITICAL",
        code: "ATTENDANCE_ORPHAN_BATCH",
        title: "Attendance.batchId points to missing Batch",
        sql: Prisma.sql`
          SELECT a."id" as id
          FROM "Attendance" a
          LEFT JOIN "Batch" ba ON ba."id" = a."batchId"
          WHERE ba."id" IS NULL
        `,
      },
      {
        severity: "CRITICAL",
        code: "PROGRESS_ASSESSMENT_ORPHANS",
        title: "ProgressAssessment references missing Institute/Student/Batch/User",
        sql: Prisma.sql`
          SELECT pa."id" as id
          FROM "ProgressAssessment" pa
          LEFT JOIN "Institute" i ON i."id" = pa."instituteId"
          LEFT JOIN "Student" s ON s."id" = pa."studentId"
          LEFT JOIN "Batch" ba ON ba."id" = pa."batchId"
          LEFT JOIN "User" au ON au."id" = pa."authorUserId"
          WHERE i."id" IS NULL OR s."id" IS NULL OR ba."id" IS NULL OR au."id" IS NULL
        `,
      },
      {
        severity: "HIGH",
        code: "INVITE_ORPHANS",
        title: "Invite references missing Institute/Branch/Student/User",
        sql: Prisma.sql`
          SELECT inv."id" as id
          FROM "Invite" inv
          LEFT JOIN "Institute" i ON i."id" = inv."instituteId"
          LEFT JOIN "Branch" b ON b."id" = inv."branchId"
          LEFT JOIN "Student" s ON s."id" = inv."studentId"
          LEFT JOIN "User" u1 ON u1."id" = inv."inviterUserId"
          LEFT JOIN "User" u2 ON u2."id" = inv."invitedUserId"
          WHERE i."id" IS NULL
             OR (inv."branchId" IS NOT NULL AND b."id" IS NULL)
             OR (inv."studentId" IS NOT NULL AND s."id" IS NULL)
             OR u1."id" IS NULL
             OR u2."id" IS NULL
        `,
      },
      {
        severity: "CRITICAL",
        code: "STUDENT_REVIEW_ORPHANS",
        title: "StudentReview references missing Institute/Student/Author",
        sql: Prisma.sql`
          SELECT sr."id" as id
          FROM "StudentReview" sr
          LEFT JOIN "Institute" i ON i."id" = sr."instituteId"
          LEFT JOIN "Student" s ON s."id" = sr."studentId"
          LEFT JOIN "User" u ON u."id" = sr."authorUserId"
          WHERE i."id" IS NULL OR s."id" IS NULL OR u."id" IS NULL
        `,
      },
      {
        severity: "HIGH",
        code: "COACH_ORPHAN_INSTITUTE",
        title: "Coach.instituteId set but Institute missing",
        sql: Prisma.sql`
          SELECT c."id" as id
          FROM "Coach" c
          LEFT JOIN "Institute" i ON i."id" = c."instituteId"
          WHERE c."instituteId" IS NOT NULL AND i."id" IS NULL
        `,
      },
      {
        severity: "HIGH",
        code: "BRANCH_ORPHAN_INSTITUTE",
        title: "Branch.instituteId set but Institute missing",
        sql: Prisma.sql`
          SELECT b."id" as id
          FROM "Branch" b
          LEFT JOIN "Institute" i ON i."id" = b."instituteId"
          WHERE b."instituteId" IS NOT NULL AND i."id" IS NULL
        `,
      },
    ];

    for (const c of checks) {
      const r = await rawCountAndSamples(c.sql);
      findings.push({
        severity: r.count > 0 ? c.severity : "INFO",
        code: c.code,
        title: c.title,
        description: "Foreign key value points to a missing row (data corruption / unsafe hardening).",
        count: r.count,
        sampleIds: r.sampleIds,
      });
    }
  }

  section("Cross-institute mismatches (tenant boundary violations)");
  {
    const mismatchChecks: Array<{ severity: Severity; code: string; title: string; sql: Prisma.Sql }> = [
      {
        severity: "CRITICAL",
        code: "USER_BRANCH_INSTITUTE_MISMATCH",
        title: "User.instituteId != Branch.instituteId (when both present)",
        sql: Prisma.sql`
          SELECT u."id" as id
          FROM "User" u
          JOIN "Branch" b ON b."id" = u."branchId"
          WHERE u."instituteId" IS NOT NULL
            AND b."instituteId" IS NOT NULL
            AND u."instituteId" <> b."instituteId"
        `,
      },
      {
        severity: "CRITICAL",
        code: "BATCH_BRANCH_INSTITUTE_MISMATCH",
        title: "Batch.instituteId != Branch.instituteId (when both present)",
        sql: Prisma.sql`
          SELECT ba."id" as id
          FROM "Batch" ba
          JOIN "Branch" b ON b."id" = ba."branchId"
          WHERE ba."instituteId" IS NOT NULL
            AND b."instituteId" IS NOT NULL
            AND ba."instituteId" <> b."instituteId"
        `,
      },
      {
        severity: "CRITICAL",
        code: "STUDENT_BATCH_INSTITUTE_MISMATCH",
        title: "Student.instituteId != Batch.instituteId (when both present)",
        sql: Prisma.sql`
          SELECT s."id" as id
          FROM "Student" s
          JOIN "Batch" ba ON ba."id" = s."batchId"
          WHERE s."instituteId" IS NOT NULL
            AND ba."instituteId" IS NOT NULL
            AND s."instituteId" <> ba."instituteId"
        `,
      },
      {
        severity: "CRITICAL",
        code: "ATTENDANCE_BATCH_INSTITUTE_MISMATCH",
        title: "Attendance.instituteId != Batch.instituteId (when both present)",
        sql: Prisma.sql`
          SELECT a."id" as id
          FROM "Attendance" a
          JOIN "Batch" ba ON ba."id" = a."batchId"
          WHERE a."instituteId" IS NOT NULL
            AND ba."instituteId" IS NOT NULL
            AND a."instituteId" <> ba."instituteId"
        `,
      },
      {
        severity: "CRITICAL",
        code: "INVITE_BRANCH_INSTITUTE_MISMATCH",
        title: "Invite.instituteId != Branch.instituteId (when branchId present)",
        sql: Prisma.sql`
          SELECT inv."id" as id
          FROM "Invite" inv
          JOIN "Branch" b ON b."id" = inv."branchId"
          WHERE b."instituteId" IS NOT NULL
            AND inv."instituteId" <> b."instituteId"
        `,
      },
      {
        severity: "CRITICAL",
        code: "INVITE_STUDENT_INSTITUTE_MISMATCH",
        title: "Invite.instituteId != Student.instituteId (when studentId present)",
        sql: Prisma.sql`
          SELECT inv."id" as id
          FROM "Invite" inv
          JOIN "Student" s ON s."id" = inv."studentId"
          WHERE s."instituteId" IS NOT NULL
            AND inv."instituteId" <> s."instituteId"
        `,
      },
      {
        severity: "CRITICAL",
        code: "STUDENT_REVIEW_STUDENT_INSTITUTE_MISMATCH",
        title: "StudentReview.instituteId != Student.instituteId",
        sql: Prisma.sql`
          SELECT sr."id" as id
          FROM "StudentReview" sr
          JOIN "Student" s ON s."id" = sr."studentId"
          WHERE s."instituteId" IS NOT NULL
            AND sr."instituteId" <> s."instituteId"
        `,
      },
      {
        severity: "CRITICAL",
        code: "PROGRESS_ASSESSMENT_TENANT_MISMATCH",
        title: "ProgressAssessment.instituteId mismatches its Student/Batch instituteId",
        sql: Prisma.sql`
          SELECT pa."id" as id
          FROM "ProgressAssessment" pa
          JOIN "Student" s ON s."id" = pa."studentId"
          JOIN "Batch" ba ON ba."id" = pa."batchId"
          WHERE (s."instituteId" IS NOT NULL AND pa."instituteId" <> s."instituteId")
             OR (ba."instituteId" IS NOT NULL AND pa."instituteId" <> ba."instituteId")
        `,
      },
    ];

    for (const c of mismatchChecks) {
      const r = await rawCountAndSamples(c.sql);
      findings.push({
        severity: r.count > 0 ? c.severity : "INFO",
        code: c.code,
        title: c.title,
        description: "Tenant boundary violation (cross-institute linkage).",
        count: r.count,
        sampleIds: r.sampleIds,
      });
    }
  }

  section("Ownership chain gaps (derived tenant missing)");
  {
    const chainChecks: Array<{ severity: Severity; code: string; title: string; sql: Prisma.Sql }> = [
      {
        severity: "HIGH",
        code: "STUDENT_NULL_INSTITUTE_BUT_BATCH_HAS_ONE",
        title: "Student.instituteId is null but its Batch has instituteId",
        sql: Prisma.sql`
          SELECT s."id" as id
          FROM "Student" s
          JOIN "Batch" ba ON ba."id" = s."batchId"
          WHERE s."instituteId" IS NULL AND ba."instituteId" IS NOT NULL
        `,
      },
      {
        severity: "HIGH",
        code: "ATTENDANCE_NULL_INSTITUTE_BUT_BATCH_HAS_ONE",
        title: "Attendance.instituteId is null but its Batch has instituteId",
        sql: Prisma.sql`
          SELECT a."id" as id
          FROM "Attendance" a
          JOIN "Batch" ba ON ba."id" = a."batchId"
          WHERE a."instituteId" IS NULL AND ba."instituteId" IS NOT NULL
        `,
      },
      {
        severity: "HIGH",
        code: "USER_NULL_INSTITUTE_BUT_BRANCH_HAS_ONE",
        title: "User.instituteId is null but its Branch has instituteId",
        sql: Prisma.sql`
          SELECT u."id" as id
          FROM "User" u
          JOIN "Branch" b ON b."id" = u."branchId"
          WHERE u."instituteId" IS NULL AND b."instituteId" IS NOT NULL
        `,
      },
      {
        severity: "HIGH",
        code: "BATCH_NULL_INSTITUTE_BUT_BRANCH_HAS_ONE",
        title: "Batch.instituteId is null but its Branch has instituteId",
        sql: Prisma.sql`
          SELECT ba."id" as id
          FROM "Batch" ba
          JOIN "Branch" b ON b."id" = ba."branchId"
          WHERE ba."instituteId" IS NULL AND b."instituteId" IS NOT NULL
        `,
      },
    ];

    for (const c of chainChecks) {
      const r = await rawCountAndSamples(c.sql);
      findings.push({
        severity: r.count > 0 ? c.severity : "INFO",
        code: c.code,
        title: c.title,
        description:
          "Indicates tenant id could be backfilled deterministically from the ownership chain.",
        count: r.count,
        sampleIds: r.sampleIds,
      });
    }
  }

  // Print results grouped by severity for readability.
  section("Findings (grouped by severity)");
  const order: Severity[] = ["CRITICAL", "HIGH", "WARNING", "INFO"];
  for (const sev of order) {
    console.log("");
    console.log(`### ${sev}`);
    for (const f of findings.filter((x) => x.severity === sev)) {
      printFinding(f);
    }
  }

  const critical = findings.filter((f) => f.severity === "CRITICAL" && f.count > 0).length;
  const high = findings.filter((f) => f.severity === "HIGH" && f.count > 0).length;

  console.log("");
  console.log("Summary:");
  console.log(`  Critical categories with hits: ${critical}`);
  console.log(`  High categories with hits:     ${high}`);
  console.log("  (Re-run after any backfill/repair to track progress.)");
}

run()
  .catch((e) => {
    console.error("");
    console.error("[CRITICAL] audit failed unexpectedly.");
    console.error(String((e as any)?.stack ?? (e as any)?.message ?? e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

