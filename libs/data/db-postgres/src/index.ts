/**
 * Central PostgreSQL access (Prisma).
 *
 * The Prisma schema lives in `prisma/schema.prisma`. Run `pnpm db:generate`
 * to emit the typed client, then import it here. Kept as a thin re-export so
 * the NestJS API and reporting modules share one client configuration.
 *
 * Generation is intentionally deferred in this pass (no running Postgres
 * required for the offline POS demo); see docs/database-model.md.
 */
export interface PostgresConfig {
  databaseUrl: string;
}

export const CENTRAL_SCHEMA_PATH = 'libs/data/db-postgres/prisma/schema.prisma';

// After `pnpm db:generate`:
//   export { PrismaClient } from '@prisma/client';
//   export const createClient = (cfg: PostgresConfig) =>
//     new PrismaClient({ datasources: { db: { url: cfg.databaseUrl } } });
