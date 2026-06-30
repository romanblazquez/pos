# Canonical catalog migration plan

## Checked-in physical migrations

```text
prisma/migrations/
├── 20260630009000_postgres_capabilities/
│   └── migration.sql   # pgcrypto, pg_trgm, unaccent, citext, btree_gin; optional pgvector
├── 20260630010000_canonical_catalog_v2/
│   └── migration.sql   # additive enums, tables, constraints, FKs, Prisma indexes
├── 20260630011000_canonical_catalog_constraints_indexes/
│   └── migration.sql   # checks, partial/GIN/trigram indexes, partitions, FTS, read model
└── 20260630012000_canonical_reference_seed/
    └── migration.sql   # stable countries/currencies/languages/sources/identifier namespaces
```

The initial DDL is intentionally one additive referential unit. The ten product rollout phases below are application/backfill phases and each receives its own later migration only when additional schema is required. Splitting mutually dependent empty-table DDL into artificial releases would increase partial-deploy risk without improving rollback safety.

## Rollout migration sequence

| Phase | Expected future folder prefix | Schema/data operation |
|---|---|---|
| 1 | `*_p01_catalog_backfill_support` | backfill checkpoints and legacy-to-canonical mapping if the job needs persisted state |
| 2 | `*_p02_identifier_claim_backfill` | normalize BGG/barcode/source IDs into namespaces, claims, and attributions |
| 3 | `*_p03_offer_dual_write` | listing-to-current-offer backfill, dual-write checkpoint, partition monitoring |
| 4 | `*_p04_matching_cutover` | candidate/decision backfill, matching algorithm version activation |
| 5 | `*_p05_seo_slug_cutover` | localized page/slugs, historical redirects, sitemap eligibility |
| 6 | `*_p06_search_projection_cutover` | search projection checkpoints and engine alias version |
| 7 | `*_p07_user_identity_remap` | collection/wishlist/alert remap to canonical IDs |
| 8 | `*_p08_affiliate_analytics_cutover` | click ID and conversion reconciliation cutover |
| 9 | `*_p09_graph_ai_projection` | graph projection versions and optional vector infrastructure |
| 10 | `*_p10_scale_retention` | regional/hash subpartitioning, archive manifests, retention automation |

## Deployment commands

```bash
pnpm db:generate
npx prisma validate --schema libs/data/db-postgres/prisma/schema.prisma
npx prisma migrate deploy --schema libs/data/db-postgres/prisma/schema.prisma
```

Do not use `prisma db push` for production. It cannot safely represent the raw partial indexes, partitions, checks, materialized view, or optional vector path.

## Backfill rules

1. Backfills are resumable jobs, not one giant migration transaction.
2. Process keyset ranges and record source ID, last key, counts, failures, and algorithm version.
3. A legacy `MktProduct` becomes at least one master game and catalog product; edition/printing are created only when supported by evidence.
4. Existing BGG IDs become external identifiers. They never become canonical primary keys.
5. Existing `Listing` rows become current offers and receive an initial price/inventory snapshot.
6. Every inferred field is a source claim with legacy/raw attribution.
7. Shadow-read parity must pass before a consumer switches to v2.
8. Legacy tables remain unchanged throughout the backfill and dual-write window.

## Rollback

The schema migration is additive, so application rollback is a feature-flag/consumer rollback. Do not drop v2 tables during an incident. Disable v2 writes, continue legacy operation, preserve raw/import data, and reconcile forward after root cause analysis.

## Validation already performed

- Prisma schema format and validation;
- Prisma client generation;
- full migration chain on a fresh PostgreSQL 16 database without pgvector;
- reference seed application;
- canonical Catan example insertion (`MasterGame -> GameEdition -> GamePrinting -> CatalogProduct`);
- partition presence for price, inventory, affiliate click, and analytics streams;
- materialized offer-summary view presence;
- API TypeScript typecheck.

