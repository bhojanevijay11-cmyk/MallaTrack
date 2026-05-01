// Safe admin seed script (idempotent).
// Usage: npm run seed:admin

require("dotenv/config");

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function main() {
  const ADMIN_EMAIL = normalizeEmail("admin@mallatrack.com");
  const ADMIN_PASSWORD = "Admin123!"; // change after first login
  const ADMIN_ROLE = "admin";

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Create a .env with DATABASE_URL (e.g. file:./dev.db).",
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, role: true },
  });

  if (existing) {
    console.log(
      `seed:admin: already exists (${existing.email}, role=${existing.role}, id=${existing.id})`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const created = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: ADMIN_ROLE,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(
    `seed:admin: created (${created.email}, role=${created.role}, id=${created.id})`,
  );
  console.log(`seed:admin: credentials email=${ADMIN_EMAIL} password=${ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("seed:admin: failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

