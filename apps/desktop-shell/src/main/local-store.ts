import { join } from 'node:path';
import { app } from 'electron';
import {
  openDatabase,
  ProductRepository,
  SaleRepository,
  OutboxRepository,
  type Db,
} from '@retail-os/local-db';
import { SyncEngine, InMemorySyncTarget } from '@retail-os/sync-engine';
import type { ProductSnapshot } from '@retail-os/catalog';
import type { SaleSnapshot } from '@retail-os/sales';
import seedProducts from '@config/seed-products.json';

export interface Terminal {
  tenantId: string;
  storeId: string;
  deviceId: string;
  currency: string;
}

export interface SyncStatus {
  online: boolean;
  pending: number;
  lastSyncedAt: string | null;
}

/**
 * LocalStore — the Electron main process's owner of the offline SQLite database.
 *
 * It seeds the catalog on first run, persists committed sales + their outbox row
 * in a single transaction (durable, never-lose-a-sale), and runs the SyncEngine
 * that drains the outbox to the central API. The renderer reaches all of this
 * only through the preload IPC bridge — it never touches Node or SQLite directly.
 */
export class LocalStore {
  readonly db: Db;
  readonly products: ProductRepository;
  readonly sales: SaleRepository;
  readonly outbox: OutboxRepository;
  readonly terminal: Terminal = {
    tenantId: 'tenant-demo',
    storeId: 'store-centro-01',
    deviceId: 'POS-01',
    currency: 'MXN',
  };

  private readonly engine: SyncEngine;
  private status: SyncStatus = { online: true, pending: 0, lastSyncedAt: null };

  constructor() {
    const file = join(app.getPath('userData'), 'retail-os.sqlite');
    this.db = openDatabase(file);
    this.products = new ProductRepository(this.db);
    this.sales = new SaleRepository(this.db);
    this.outbox = new OutboxRepository(this.db);

    if (this.products.count() === 0) {
      this.products.upsertMany(seedProducts as ProductSnapshot[]);
    }

    // In-memory sync target for the offline demo: sales "ship" locally and the
    // queue drains. Swap for `new HttpSyncTarget(apiBaseUrl)` to sync to NestJS.
    this.engine = new SyncEngine(this.outbox, this.sales, new InMemorySyncTarget(), {
      deviceId: this.terminal.deviceId,
      onStatus: (s) => (this.status = s),
    });
  }

  startSync(): void {
    this.engine.start(4000);
  }

  listProducts(): ProductSnapshot[] {
    return this.products.listAll();
  }

  /** Persist a committed sale + enqueue its sync outbox row atomically. */
  commitSale(snapshot: SaleSnapshot): { ok: boolean } {
    const tx = this.db.transaction((snap: SaleSnapshot) => {
      this.sales.insert({
        id: snap.saleId,
        status: snap.status,
        currency: snap.currency,
        storeId: snap.storeId,
        deviceId: snap.deviceId,
        customerId: snap.customerId ?? undefined,
        totalMinorUnits: snap.totals.grandTotal.minorUnits,
        snapshot: snap,
        committedAt: snap.committedAt,
      });
      this.outbox.enqueue({
        aggregateId: snap.saleId,
        type: 'sales.SaleCommitted',
        correlationId: snap.saleId,
        payload: snap,
      });
    });
    tx(snapshot);
    void this.engine.runOnce();
    return { ok: true };
  }

  getSyncStatus(): SyncStatus {
    return { ...this.status, pending: this.outbox.countPending() };
  }
}
