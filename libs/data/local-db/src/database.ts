import Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema.js';

export type Db = Database.Database;

/**
 * Open (and migrate) the local SQLite database. `better-sqlite3` is synchronous,
 * which is ideal for a POS: cart/sale writes are sub-millisecond and never block
 * on I/O callbacks. Pass ':memory:' in tests.
 */
export function openDatabase(filename: string): Db {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  // Apply additive column migrations before the schema (which creates indexes).
  migrateColumns(db);
  db.exec(SCHEMA_SQL);
  return db;
}

function migrateColumns(db: Database.Database): void {
  const tableExists = (db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get('products') as { name: string } | undefined);
  if (!tableExists) return;

  const cols = (db.prepare('PRAGMA table_info(products)').all() as { name: string }[]).map(
    (c) => c.name,
  );
  const add = (col: string, def: string) => {
    if (!cols.includes(col)) db.prepare(`ALTER TABLE products ADD COLUMN ${col} ${def}`).run();
  };
  add('track_inv', 'INTEGER NOT NULL DEFAULT 1');
  add('active', 'INTEGER NOT NULL DEFAULT 1');
  add('template_id', 'TEXT');
  add('variant_description', 'TEXT');
  add('image_url', 'TEXT');
  add('stock_on_hand', 'INTEGER');
  add('stock_locations', 'TEXT');
}
