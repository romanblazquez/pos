import type { ProductSnapshot } from '@retail-os/catalog';
import type { SaleSnapshot } from '@retail-os/sales';

/**
 * The data surface the Electron shell exposes on `window.retailData` (via the
 * secure preload). It is the renderer's only door to the local SQLite store —
 * the renderer never touches the database or Node directly, preserving context
 * isolation. When the POS runs in a plain browser (no shell) this is absent and
 * the app falls back to an in-memory store seeded from config.
 */
export interface RetailDataApi {
  listProducts(): Promise<ProductSnapshot[]>;
  /** Commit a sale: persists the snapshot + enqueues the sync outbox row atomically. */
  commitSale(snapshot: SaleSnapshot): Promise<{ ok: boolean }>;
  getSyncStatus(): Promise<{ online: boolean; pending: number; lastSyncedAt: string | null }>;
  /** Identity/config for this terminal. */
  getTerminal(): Promise<{ tenantId: string; storeId: string; deviceId: string; currency: string }>;
}

export interface RetailEnv {
  inShell: boolean;
  appId: string;
}

declare global {
  interface Window {
    retailData?: RetailDataApi;
    retailEnv?: RetailEnv;
  }
}

export function isInShell(): boolean {
  return typeof window !== 'undefined' && !!window.retailData;
}
