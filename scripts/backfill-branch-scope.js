/**
 * One-time dev helper: attach default Branch to batches/users missing branchId.
 * Usage: node scripts/backfill-branch-scope.js
 */
require("dotenv/config");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const branch =
    (await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await prisma.branch.create({ data: { name: "Main" } }));

  const b = await prisma.batch.updateMany({
    where: { branchId: null },
    data: { branchId: branch.id },
  });
  const u = await prisma.user.updateMany({
    where: { role: "head_coach", branchId: null },
    data: { branchId: branch.id },
  });
  console.log(
    `backfill-branch-scope: branch=${branch.id} batchesUpdated=${b.count} headCoachesUpdated=${u.count}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
