// Safe local cleanup script (targets one email).
// Usage:
//   npm run cleanup:user -- admin@example.com
//   npm run cleanup:user -- admin@example.com --delete
//   npm run cleanup:user -- admin@example.com --set-role parent
//
// Defaults to a dry-run unless --delete or --set-role is provided.

require("dotenv/config");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const email = args.find((a) => !a.startsWith("-")) || "";
  const deleteFlag = args.includes("--delete");
  const setRoleIdx = args.indexOf("--set-role");
  const setRole = setRoleIdx >= 0 ? args[setRoleIdx + 1] : null;
  return { email, deleteFlag, setRole };
}

async function main() {
  const { email, deleteFlag, setRole } = parseArgs(process.argv);
  const normalized = normalizeEmail(email);
  if (!normalized) {
    console.log("cleanup:user: provide an email (example: admin@example.com)");
    process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Create a .env with DATABASE_URL (e.g. file:./dev.db).",
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  if (!user) {
    console.log(`cleanup:user: no user found for ${normalized}`);
    return;
  }

  if (!deleteFlag && !setRole) {
    console.log("cleanup:user: dry-run (no changes made)");
    console.log(user);
    console.log(
      "cleanup:user: use --delete or --set-role <role> to apply a change",
    );
    return;
  }

  if (deleteFlag && setRole) {
    console.log("cleanup:user: choose only one: --delete OR --set-role");
    process.exitCode = 1;
    return;
  }

  if (deleteFlag) {
    const deleted = await prisma.user.delete({
      where: { email: normalized },
      select: { id: true, email: true, role: true },
    });
    console.log("cleanup:user: deleted", deleted);
    return;
  }

  const updated = await prisma.user.update({
    where: { email: normalized },
    data: { role: String(setRole) },
    select: { id: true, email: true, role: true },
  });
  console.log("cleanup:user: updated role", updated);
}

main()
  .catch((err) => {
    console.error("cleanup:user: failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

