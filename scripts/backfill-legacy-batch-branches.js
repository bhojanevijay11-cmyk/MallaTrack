// Idempotent per institute: when exactly one Branch exists for an institute, sets Batch.branchId
// for legacy rows in that institute where branchId is null.
// Usage: npm run backfill:legacy-batch-branches
// Safe: skips institutes with 0 or 2+ branches; leaves null when ambiguous.

require("dotenv/config");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const institutes = await prisma.institute.findMany({
    select: { id: true },
  });

  let total = 0;
  for (const inst of institutes) {
    const branches = await prisma.branch.findMany({
      where: { instituteId: inst.id },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 2,
    });
    if (branches.length !== 1) {
      continue;
    }
    const branchId = branches[0].id;
    const res = await prisma.batch.updateMany({
      where: { instituteId: inst.id, branchId: null },
      data: { branchId },
    });
    total += res.count;
    if (res.count > 0) {
      console.log(
        `backfill: institute ${inst.id} → ${res.count} batch(es) → branch ${branchId}`,
      );
    }
  }

  console.log(`backfill: total batches updated: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
