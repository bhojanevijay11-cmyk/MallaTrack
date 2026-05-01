/**
 * Idempotent: assigns nullable instituteId on all tenant tables using the default institute.
 * Usage: npm run backfill:institute
 */
import "dotenv/config";

import { backfillInstituteOwnership } from "../lib/backfill-institute";
import { prisma } from "../lib/prisma";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const r = await backfillInstituteOwnership();

  console.log("backfill:institute — done");
  console.log(`  institute: ${r.instituteName} (${r.instituteId})`);
  console.log(`  Branch rows updated:           ${r.branchRows}`);
  console.log(`  User (from branch) rows:       ${r.userFromBranchRows}`);
  console.log(`  User (default) rows:           ${r.userDefaultRows}`);
  console.log(`  Batch (from branch) rows:      ${r.batchFromBranchRows}`);
  console.log(`  Batch (default) rows:          ${r.batchDefaultRows}`);
  console.log(`  Student (from batch) rows:     ${r.studentFromBatchRows}`);
  console.log(`  Student (default) rows:        ${r.studentDefaultRows}`);
  console.log(`  Coach rows updated:            ${r.coachRows}`);
  console.log(`  Attendance rows updated:       ${r.attendanceRows}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
