/**
 * Dev-only: idempotent SUPER_ADMIN (`super_admin`) with no institute.
 * Gate: skips if platform-admin@mallatrack.test already exists.
 *
 * Usage: npm run seed:super-admin:dev
 * Refuses when NODE_ENV === "production".
 */
require("dotenv/config");

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ROLE_SUPER_ADMIN = "super_admin";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed-super-admin-dev: refused in production.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Create a .env with DATABASE_URL (e.g. file:./dev.db).",
    );
  }

  const email = normalizeEmail("platform-admin@mallatrack.test");
  const password = "PlatformDev123!";

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  if (existing) {
    console.log(
      `seed:super-admin:dev: already exists (${existing.email}, role=${existing.role}, id=${existing.id})`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: ROLE_SUPER_ADMIN,
      instituteId: null,
      branchId: null,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(
    `seed:super-admin:dev: created (${created.email}, role=${created.role}, id=${created.id})`,
  );
  console.log(`seed:super-admin:dev: credentials email=${email} password=${password}`);
}

main()
  .catch((err) => {
    console.error("seed:super-admin:dev: failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
