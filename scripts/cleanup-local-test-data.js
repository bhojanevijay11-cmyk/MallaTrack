/**
 * Local SQLite dev ONLY: remove seeded / legacy test tenants so Platform Health matches pilot data.
 *
 * Does NOT run in production, non-SQLite URLs, or without --confirm.
 * Does NOT hook into build, postinstall, or deploy.
 *
 * Usage:
 *   npm run cleanup:local-test-data              # dry-run: prints plan only
 *   npm run cleanup:local-test-data -- --confirm # apply deletions
 *
 * Institutes removed (name match, case-insensitive, trimmed):
 *   Default — from ensureDefaultInstitute / legacy onboarding
 *   SGAM, Samata — from seed:two-institutes:dev
 *
 * Preserves: all super_admin users; every institute not in the list above; their branches, batches, students, staff.
 */

require("dotenv/config");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ROLE_SUPER_ADMIN = "super_admin";

/** Institute display names to remove (exact match after trim, case-insensitive). Edit this list if your dev DB uses different seed labels. */
const INSTITUTE_NAMES_TO_REMOVE = new Set(
  ["default", "sgam", "samata"].map((s) => s.toLowerCase()),
);

function normalizeInstituteName(name) {
  return String(name || "").trim().toLowerCase();
}

function assertLocalSqliteOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "cleanup-local-test-data: refused — NODE_ENV is production.",
    );
  }
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) {
    throw new Error(
      "cleanup-local-test-data: DATABASE_URL is not set (e.g. file:./dev.db).",
    );
  }
  const lower = url.toLowerCase();
  if (
    lower.startsWith("postgresql:") ||
    lower.startsWith("postgres:") ||
    lower.startsWith("mysql:") ||
    lower.startsWith("sqlserver:")
  ) {
    throw new Error(
      "cleanup-local-test-data: refused — DATABASE_URL must be local SQLite (file:...), not a server database.",
    );
  }
  if (!lower.startsWith("file:")) {
    throw new Error(
      "cleanup-local-test-data: refused — DATABASE_URL must start with file: (SQLite).",
    );
  }
}

function parseConfirm(argv) {
  return argv.slice(2).includes("--confirm");
}

async function summarizeInstitute(instituteId) {
  const [
    branches,
    batches,
    students,
    coaches,
    invites,
    tenantUsers,
    progressAssessments,
    studentReviews,
    attendance,
    progressEntries,
  ] = await Promise.all([
    prisma.branch.count({ where: { instituteId } }),
    prisma.batch.count({ where: { instituteId } }),
    prisma.student.count({ where: { instituteId } }),
    prisma.coach.count({ where: { instituteId } }),
    prisma.invite.count({ where: { instituteId } }),
    prisma.user.count({
      where: { instituteId, role: { not: ROLE_SUPER_ADMIN } },
    }),
    prisma.progressAssessment.count({ where: { instituteId } }),
    prisma.studentReview.count({ where: { instituteId } }),
    prisma.attendance.count({
      where: {
        OR: [
          { instituteId },
          { batch: { instituteId } },
          { student: { instituteId } },
        ],
      },
    }),
    prisma.studentProgressEntry.count({
      where: {
        OR: [{ instituteId }, { student: { instituteId } }],
      },
    }),
  ]);

  return {
    branches,
    batches,
    students,
    coaches,
    invites,
    tenantUsers,
    progressAssessments,
    studentReviews,
    attendance,
    progressEntries,
  };
}

async function deleteInstituteAndScopedData(instituteId) {
  const batches = await prisma.batch.findMany({
    where: { instituteId },
    select: { id: true },
  });
  const batchIds = batches.map((b) => b.id);

  const students = await prisma.student.findMany({
    where: { instituteId },
    select: { id: true },
  });
  const studentIds = students.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    await tx.invite.deleteMany({ where: { instituteId } });

    if (batchIds.length > 0) {
      await tx.batchAssistant.deleteMany({
        where: { batchId: { in: batchIds } },
      });
    }

    await tx.progressAssessment.deleteMany({ where: { instituteId } });
    await tx.studentReview.deleteMany({ where: { instituteId } });

    await tx.attendance.deleteMany({
      where: {
        OR: [
          { instituteId },
          ...(batchIds.length ? [{ batchId: { in: batchIds } }] : []),
          ...(studentIds.length ? [{ studentId: { in: studentIds } }] : []),
        ],
      },
    });

    await tx.studentProgressEntry.deleteMany({
      where: {
        OR: [
          { instituteId },
          ...(studentIds.length ? [{ studentId: { in: studentIds } }] : []),
        ],
      },
    });

    await tx.student.deleteMany({ where: { instituteId } });
    await tx.batch.deleteMany({ where: { instituteId } });
    await tx.coach.deleteMany({ where: { instituteId } });

    await tx.user.deleteMany({
      where: { instituteId, role: { not: ROLE_SUPER_ADMIN } },
    });

    await tx.branch.deleteMany({ where: { instituteId } });

    await tx.platformAuditLog.deleteMany({ where: { instituteId } });

    await tx.institute.delete({ where: { id: instituteId } });
  });
}

async function main() {
  assertLocalSqliteOnly();

  const confirmed = parseConfirm(process.argv);
  if (!confirmed) {
    console.log(
      "cleanup-local-test-data: DRY RUN (no changes). Pass --confirm to apply.\n",
    );
  }

  const superAdmins = await prisma.user.findMany({
    where: { role: ROLE_SUPER_ADMIN },
    select: { id: true, email: true, instituteId: true },
  });

  const allInstitutes = await prisma.institute.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  const targets = allInstitutes.filter((i) =>
    INSTITUTE_NAMES_TO_REMOVE.has(normalizeInstituteName(i.name)),
  );

  const kept = allInstitutes.filter(
    (i) => !INSTITUTE_NAMES_TO_REMOVE.has(normalizeInstituteName(i.name)),
  );

  console.log("cleanup-local-test-data: configuration");
  console.log(
    `  Remove institutes whose name is one of: ${[...INSTITUTE_NAMES_TO_REMOVE].join(", ")}`,
  );
  console.log(`  DATABASE_URL: ${(process.env.DATABASE_URL || "").split("?")[0]}`);
  console.log("");

  console.log("cleanup-local-test-data: preserved users (super_admin)");
  if (superAdmins.length === 0) {
    console.log("  (none found — unexpected for platform dev)");
  } else {
    for (const u of superAdmins) {
      console.log(
        `  - ${u.email} id=${u.id} instituteId=${u.instituteId ?? "null"}`,
      );
    }
  }
  console.log("");

  console.log("cleanup-local-test-data: institutes kept (not in remove list)");
  if (kept.length === 0) {
    console.log("  (none)");
  } else {
    for (const i of kept) {
      console.log(`  - "${i.name}" id=${i.id}`);
    }
  }
  console.log("");

  if (targets.length === 0) {
    console.log(
      "cleanup-local-test-data: no matching institutes to remove — nothing to do.",
    );
    return;
  }

  if (kept.length === 0) {
    throw new Error(
      "cleanup-local-test-data: refused — removal would delete every institute; add or rename a pilot institute first.",
    );
  }

  console.log("cleanup-local-test-data: institutes scheduled for REMOVAL");
  for (const i of targets) {
    const s = await summarizeInstitute(i.id);
    console.log(`  ■ "${i.name}" id=${i.id}`);
    console.log(
      `      branches=${s.branches} batches=${s.batches} students=${s.students} coaches=${s.coaches}`,
    );
    console.log(
      `      invites=${s.invites} tenant users (non–super_admin)=${s.tenantUsers}`,
    );
    console.log(
      `      progress assessments=${s.progressAssessments} student reviews=${s.studentReviews}`,
    );
    console.log(
      `      attendance rows=${s.attendance} progress entries=${s.progressEntries}`,
    );
    console.log(
      `      + PlatformAuditLog rows for this institute (will be deleted)`,
    );
  }
  console.log("");

  if (!confirmed) {
    console.log(
      "cleanup-local-test-data: re-run with: npm run cleanup:local-test-data -- --confirm",
    );
    return;
  }

  for (const i of targets) {
    console.log(`cleanup-local-test-data: deleting "${i.name}" (${i.id})…`);
    await deleteInstituteAndScopedData(i.id);
  }

  console.log("");
  console.log("cleanup-local-test-data: done.");
}

main()
  .catch((err) => {
    console.error("cleanup-local-test-data: failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
