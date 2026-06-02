# Retail OS — Central API (NestJS modular monolith)

The central backend: receives synced sales from terminals and (on the roadmap) serves
master data, reporting, auth and payment webhooks. Module boundaries mirror the domain
bounded contexts, so any context can later be extracted into its own service behind the
same contracts.

## This pass (scaffold + final contract)
- `POST /sync/sales` — idempotent sale ingestion (matches `SaleIngestionRequest` that the
  edge `SyncEngine` already sends; see [`docs/api-spec.md`](../../docs/api-spec.md)).
- `GET /health`, `GET /health/ready` — probes.
- `SyncService` keeps idempotency keys in memory; production persists via Prisma
  (`IngestionKey` ledger + `Sale`/`SaleLine`/`Payment`).

Source is fully typechecked by `pnpm typecheck`.

## Running (roadmap milestone)
Wire the runtime with the Nest toolchain (`@nestjs/cli` + SWC for decorator metadata) and
Prisma against the Postgres in [`infra/docker-compose.yml`](../../infra/docker-compose.yml):

```bash
docker compose -f infra/docker-compose.yml up -d postgres
pnpm db:generate
# nest start  (added with the API milestone)
```
