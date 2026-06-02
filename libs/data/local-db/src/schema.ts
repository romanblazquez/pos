/**
 * Local SQLite schema (offline-first store).
 *
 * The POS terminal owns a durable local database so it never loses a sale when
 * the network is gone:
 *  - `products`  — read cache of the catalog for instant offline search.
 *  - `sales`     — committed sale snapshots (the source of truth until synced).
 *  - `outbox`    — transactional outbox; every committed sale enqueues a row
 *                  that the sync-engine drains to the central API exactly once.
 *  - `saga_log`  — persisted CheckoutSaga state for crash recovery.
 *
 * The schema is intentionally append-friendly and uses WAL for concurrent reads.
 */
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  sku           TEXT NOT NULL,
  name          TEXT NOT NULL,
  barcode       TEXT,
  category      TEXT NOT NULL,
  price_minor   INTEGER NOT NULL,
  currency      TEXT NOT NULL,
  tax_rate      REAL NOT NULL,
  track_inv     INTEGER NOT NULL DEFAULT 1,
  active        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

CREATE TABLE IF NOT EXISTS sales (
  id            TEXT PRIMARY KEY,
  status        TEXT NOT NULL,
  currency      TEXT NOT NULL,
  store_id      TEXT NOT NULL,
  device_id     TEXT NOT NULL,
  customer_id   TEXT,
  total_minor   INTEGER NOT NULL,
  snapshot      TEXT NOT NULL,          -- full SaleSnapshot JSON
  committed_at  TEXT NOT NULL,
  synced        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales(synced);

CREATE TABLE IF NOT EXISTS outbox (
  id            TEXT PRIMARY KEY,
  aggregate_id  TEXT NOT NULL,
  type          TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload       TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'  -- pending | synced | failed
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS saga_log (
  saga_id       TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL,
  completed_steps TEXT NOT NULL,
  current_step  INTEGER NOT NULL,
  error         TEXT,
  context       TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saga_status ON saga_log(status);
`;
