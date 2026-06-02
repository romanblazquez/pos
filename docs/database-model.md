# Database Model

Two stores, by design (see [ADR-0003](adr/0003-offline-first-sqlite-outbox.md)).

## Local edge store — SQLite (`libs/data/local-db`)
Source of truth at the terminal until synced. WAL mode, synchronous access.

| Table | Purpose |
|-------|---------|
| `products` | catalog read-cache for offline search (indexed by barcode) |
| `sales` | committed sale snapshots (`synced` flag); local source of truth |
| `outbox` | transactional outbox: `status`, `attempts`, `next_attempt_at` (backoff) |
| `saga_log` | persisted CheckoutSaga state for crash recovery |

A committed sale writes `sales` + `outbox` in **one transaction**.

## Central store — PostgreSQL via Prisma (`libs/data/db-postgres/prisma/schema.prisma`)
Multi-tenant master data, the sync sink, and the reporting source.

```
Tenant 1─* Store 1─* Device
Tenant 1─* Product
Tenant 1─* User
Store  1─* Sale 1─* SaleLine
Sale   1─* Payment
IngestionKey   // server-side idempotency ledger (exactly-once effect)
```

- Every business table is **tenant-scoped** (`tenantId`); row-level isolation now, RLS /
  schema-per-tenant on the hardening roadmap.
- `Sale.snapshot` (Json) preserves the exact edge snapshot for audit/replay; normalized
  `SaleLine`/`Payment` rows power reporting and analytics.
- Monetary values stored as integer **minor units** end-to-end (mirrors `Money`).

Generate the client: `pnpm db:generate` (deferred this pass — no running Postgres needed
for the offline demo). Migrations + a running instance come with the API on the roadmap.
