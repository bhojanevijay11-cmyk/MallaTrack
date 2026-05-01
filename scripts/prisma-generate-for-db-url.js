#!/usr/bin/env node
/**
 * MallaTrack Prisma generate entrypoint.
 *
 * Contract:
 * - DATABASE_URL with postgres / postgresql → generate from prisma/pg/schema.prisma
 * - DATABASE_URL with file: (SQLite) → generate from prisma/schema.prisma
 * - DATABASE_URL unset → SQLite schema + warning (local dev default)
 *
 * Overrides:
 * - argv: --pg  → force prisma/pg/schema.prisma
 * - env: PRISMA_GENERATE_SCHEMA → path to schema file (highest priority)
 *
 * Loads .env then .env.local (same order as typical Next local setup for overrides).
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
require("dotenv").config({ path: path.join(root, ".env.local"), quiet: true });

function resolveSchemaPath() {
  const forced = (process.env.PRISMA_GENERATE_SCHEMA || "").trim();
  if (forced) {
    return path.isAbsolute(forced) ? forced : path.join(root, forced);
  }
  if (process.argv.includes("--pg")) {
    return path.join(root, "prisma", "pg", "schema.prisma");
  }

  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) {
    console.warn(
      "[mallatrack] DATABASE_URL is unset; using SQLite schema prisma/schema.prisma for prisma generate.\n" +
        "  For Postgres (staging/production), set DATABASE_URL before install/build, or run:\n" +
        "    npm run build:pg\n" +
        "  or:\n" +
        "    PRISMA_GENERATE_SCHEMA=prisma/pg/schema.prisma npm run postinstall",
    );
    return path.join(root, "prisma", "schema.prisma");
  }

  if (/^postgres(ql)?:/i.test(url)) {
    return path.join(root, "prisma", "pg", "schema.prisma");
  }
  if (/^file:/i.test(url)) {
    return path.join(root, "prisma", "schema.prisma");
  }

  console.error(
    "[mallatrack] DATABASE_URL must use file: (SQLite) or postgres / postgresql for Prisma generate.\n" +
      "  Got a scheme we do not classify for this repo's dual-schema setup.",
  );
  process.exit(1);
}

const schemaPath = resolveSchemaPath();
if (!fs.existsSync(schemaPath)) {
  console.error(`[mallatrack] Schema file not found: ${schemaPath}`);
  process.exit(1);
}

const rel = path.relative(root, schemaPath) || schemaPath;
console.info(`[mallatrack] prisma generate --schema ${rel}`);

const prismaCli = require.resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "generate", "--schema", schemaPath], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
