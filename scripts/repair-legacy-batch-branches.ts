import "dotenv/config";

import { prisma } from "../lib/prisma";

type Decision =
  | {
      batchId: string;
      instituteId: string | null;
      decision: "REPAIR";
      branchId: string;
      logic: string;
    }
  | {
      batchId: string;
      instituteId: string | null;
      decision: "SKIP";
      reason: string;
    };

const SAMPLE_LIMIT = 25;

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

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const verbose = argv.includes("--verbose");
  return { apply, verbose };
}

async function main() {
  const { apply, verbose } = parseArgs(process.argv.slice(2));

  header("MallaTrack — Repair legacy Batch.branchId (SAFE / FAIL-CLOSED)");
  console.log(`Mode: ${apply ? "APPLY (writes enabled)" : "DRY-RUN (no writes)"}`);
  console.log(`DB: ${process.env.DATABASE_URL ? "DATABASE_URL is set" : "DATABASE_URL is NOT set"}`);

  try {
    await prisma.$connect();
  } catch (e) {
    console.log("");
    console.log("[CRITICAL] Unable to connect to database. No changes were made.");
    console.log(`          Error: ${String((e as any)?.message ?? e)}`);
    process.exitCode = 2;
    return;
  }

  const batches = await prisma.batch.findMany({
    where: { branchId: null },
    select: {
      id: true,
      name: true,
      instituteId: true,
      coachId: true,
      createdAt: true,
      updatedAt: true,
      // We use assistant assignments as a deterministic hint when unanimous.
      assistantAssignments: {
        select: {
          id: true,
          user: { select: { id: true, branchId: true, instituteId: true, role: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  section("Before state (BATCH_NULL_BRANCH)");
  console.log(`count=${batches.length}`);
  for (const b of batches.slice(0, SAMPLE_LIMIT)) {
    console.log(
      `- batchId=${b.id} name=${JSON.stringify(b.name)} instituteId=${b.instituteId ?? "null"} coachId=${b.coachId ?? "null"} createdAt=${b.createdAt.toISOString()}`,
    );
  }
  if (batches.length > SAMPLE_LIMIT) {
    console.log(`(showing first ${SAMPLE_LIMIT} of ${batches.length})`);
  }

  // Preload branches per institute for deterministic “single branch per institute” rule.
  const instituteIds = Array.from(
    new Set(batches.map((b) => b.instituteId).filter((x): x is string => Boolean(x))),
  );
  const branchesByInstitute = new Map<string, Array<{ id: string; name: string; createdAt: Date }>>();
  for (const instId of instituteIds) {
    const branches = await prisma.branch.findMany({
      where: { instituteId: instId },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    branchesByInstitute.set(instId, branches);
  }

  const decisions: Decision[] = [];

  for (const b of batches) {
    // Rule 0: Fail closed if instituteId is missing. (We do NOT guess tenant.)
    if (!b.instituteId) {
      decisions.push({
        batchId: b.id,
        instituteId: null,
        decision: "SKIP",
        reason: "Batch.instituteId is null; tenant is unknown, cannot assign branch safely.",
      });
      continue;
    }

    // Rule 1 (deterministic): institute has exactly one branch → assign it.
    const instBranches = branchesByInstitute.get(b.instituteId) ?? [];
    if (instBranches.length === 1) {
      decisions.push({
        batchId: b.id,
        instituteId: b.instituteId,
        decision: "REPAIR",
        branchId: instBranches[0].id,
        logic: "Institute has exactly one Branch; assign that branch.",
      });
      continue;
    }

    // Rule 2 (deterministic): assistant assignments exist and all assistants share the same branchId,
    // and that branch belongs to the same institute.
    const assistantBranchIds = Array.from(
      new Set(
        b.assistantAssignments
          .map((a) => a.user.branchId)
          .filter((x): x is string => typeof x === "string" && x.length > 0),
      ),
    );
    if (assistantBranchIds.length === 1) {
      const candidateBranchId = assistantBranchIds[0];
      const inSameInstitute = instBranches.some((br) => br.id === candidateBranchId);
      if (inSameInstitute) {
        decisions.push({
          batchId: b.id,
          instituteId: b.instituteId,
          decision: "REPAIR",
          branchId: candidateBranchId,
          logic: "All batch assistants have the same branchId; assign that branch (verified same institute).",
        });
        continue;
      }
      decisions.push({
        batchId: b.id,
        instituteId: b.instituteId,
        decision: "SKIP",
        reason:
          "Assistant unanimous branchId exists, but it is not a branch in Batch.instituteId (would cross tenants).",
      });
      continue;
    }

    // Otherwise ambiguous: multiple possible branches and no deterministic signal.
    decisions.push({
      batchId: b.id,
      instituteId: b.instituteId,
      decision: "SKIP",
      reason:
        instBranches.length === 0
          ? "Institute has 0 branches; cannot assign."
          : `Institute has ${instBranches.length} branches and no deterministic assignment signal (no assistant consensus).`,
    });
  }

  section("Repair decisions");
  const repair = decisions.filter((d) => d.decision === "REPAIR") as Extract<Decision, { decision: "REPAIR" }>[];
  const skipped = decisions.filter((d) => d.decision === "SKIP") as Extract<Decision, { decision: "SKIP" }>[];
  console.log(`repairable=${repair.length} skipped=${skipped.length}`);
  for (const d of decisions) {
    if (d.decision === "REPAIR") {
      console.log(`- REPAIR batchId=${d.batchId} -> branchId=${d.branchId} (${d.logic})`);
    } else if (verbose) {
      console.log(`- SKIP   batchId=${d.batchId} (${d.reason})`);
    }
  }
  if (!verbose && skipped.length > 0) {
    console.log(`(use --verbose to print all skip reasons)`);
  }

  section("Apply repairs");
  if (!apply) {
    console.log("Dry-run: no changes made. Re-run with --apply to write updates.");
  } else {
    let updated = 0;
    for (const d of repair) {
      const res = await prisma.batch.updateMany({
        where: { id: d.batchId, branchId: null, instituteId: d.instituteId },
        data: { branchId: d.branchId },
      });
      updated += res.count;
      console.log(`- updated batchId=${d.batchId} rows=${res.count}`);
    }
    console.log(`totalUpdated=${updated}`);
  }

  section("After state (remaining BATCH_NULL_BRANCH)");
  const remaining = await prisma.batch.findMany({
    where: { branchId: null },
    select: { id: true, instituteId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: SAMPLE_LIMIT,
  });
  const remainingCount = await prisma.batch.count({ where: { branchId: null } });
  console.log(`remainingCount=${remainingCount}`);
  for (const b of remaining) {
    console.log(
      `- batchId=${b.id} instituteId=${b.instituteId ?? "null"} createdAt=${b.createdAt.toISOString()}`,
    );
  }
  if (remainingCount > SAMPLE_LIMIT) console.log(`(showing first ${SAMPLE_LIMIT} of ${remainingCount})`);
}

main()
  .catch((e) => {
    console.error("");
    console.error("[CRITICAL] repair script failed unexpectedly. No partial writes should have occurred.");
    console.error(String((e as any)?.stack ?? (e as any)?.message ?? e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

