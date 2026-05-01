import fs from "node:fs";
import path from "node:path";

export type PrismaDatasourceKind = "postgresql" | "sqlite";

/**
 * Classifies DATABASE_URL for the MallaTrack dual-schema setup (SQLite dev / Postgres deploy).
 * Does not log or throw.
 */
export function classifyDatabaseUrl(url: string | undefined): "postgresql" | "sqlite" | "unset" | "unsupported" {
  const u = (url ?? "").trim();
  if (!u) return "unset";
  if (/^postgres(ql)?:/i.test(u)) return "postgresql";
  if (/^file:/i.test(u)) return "sqlite";
  return "unsupported";
}

/**
 * Reads `provider` from the generated client's schema copy (last successful `prisma generate`).
 */
export function readGeneratedPrismaDatasourceProvider(): PrismaDatasourceKind | null {
  try {
    const p = path.join(process.cwd(), "node_modules", ".prisma", "client", "schema.prisma");
    const text = fs.readFileSync(p, "utf8");
    const block = text.match(/datasource\s+db\s*\{[\s\S]*?\}/);
    if (!block) return null;
    const m = block[0].match(/provider\s*=\s*"([^"]+)"/);
    if (m?.[1] === "postgresql") return "postgresql";
    if (m?.[1] === "sqlite") return "sqlite";
  } catch {
    /* missing client — e.g. before first generate */
  }
  return null;
}

/**
 * Fails fast when the generated Prisma client does not match DATABASE_URL's family.
 * - Production: throws (deployment safety).
 * - Development: console.warn once per process.
 */
export function assertPrismaClientMatchesDatabaseUrl(): void {
  const expected = classifyDatabaseUrl(process.env.DATABASE_URL);
  if (expected === "unset" || expected === "unsupported") {
    return;
  }

  const generated = readGeneratedPrismaDatasourceProvider();
  if (!generated) {
    return;
  }

  if (generated === expected) {
    return;
  }

  const msg =
    `[mallatrack] Prisma client/provider mismatch: DATABASE_URL implies "${expected}" but ` +
    `the generated client was built for "${generated}". ` +
    `Run prisma generate with the matching schema (see scripts/prisma-generate-for-db-url.js).`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(msg);
  }
  console.warn(msg);
}
