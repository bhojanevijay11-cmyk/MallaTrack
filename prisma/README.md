# Prisma: SQLite (local) and PostgreSQL (deploy)

MallaTrack keeps **two** schema entrypoints:

| Schema file | Database | Typical `DATABASE_URL` | Migrations folder |
|-------------|----------|------------------------|-------------------|
| `prisma/schema.prisma` | SQLite | `file:./dev.db` (or `file:...`) | `prisma/migrations/` |
| `prisma/pg/schema.prisma` | PostgreSQL | `postgres://...` or `postgresql://...` | `prisma/pg/migrations/` |

## Generate / build contract

`npm install` (`postinstall`) and `npm run build` run **`scripts/prisma-generate-for-db-url.js`**, which picks the schema from:

1. `PRISMA_GENERATE_SCHEMA` (path to a `.prisma` file), if set  
2. `--pg` CLI flag → `prisma/pg/schema.prisma`  
3. Else **`DATABASE_URL`**: `postgres*` → PG schema; `file:*` → SQLite schema  
4. If `DATABASE_URL` is unset → SQLite schema (with a console warning)

So **production builds** with a Postgres `DATABASE_URL` generate the **Postgres** client automatically.

## Useful npm scripts

- `npm run build:pg` — force PG schema for generate, then `next build` (for CI without `DATABASE_URL` during generate)
- `npm run generate:pg` / `npm run postinstall:pg` — force PG client only
- `npm run migrate:*` — SQLite migrations (default schema)
- `npm run migrate:*:pg` — Postgres migrations (`--schema prisma/pg/schema.prisma`)

## Baseline resolve

- SQLite baseline migration name: `20260405174625_baseline` (`migrate:resolve-baseline`)
- Postgres baseline migration name: `20260428125700_baseline` (`migrate:resolve-baseline:pg`)

## Runtime check

`lib/prisma.ts` loads `assertPrismaClientMatchesDatabaseUrl()` so a **wrong** client (e.g. SQLite client against a Postgres URL) fails fast in **production** and warns in **development**.
