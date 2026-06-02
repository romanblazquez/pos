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
  db.exec(SCHEMA_SQL);
  return db;
}
