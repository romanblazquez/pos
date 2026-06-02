import type { Db } from './database.js';
import type { ProductSnapshot } from '@retail-os/catalog';

/** Read/write the local product cache used for offline catalog search. */
export class ProductRepository {
  constructor(private readonly db: Db) {}

  upsertMany(products: ProductSnapshot[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO products (id, sku, name, barcode, category, price_minor, currency, tax_rate, track_inv, active)
       VALUES (@id, @sku, @name, @barcode, @category, @price_minor, @currency, @tax_rate, @track_inv, @active)
       ON CONFLICT(id) DO UPDATE SET
         sku=@sku, name=@name, barcode=@barcode, category=@category,
         price_minor=@price_minor, currency=@currency, tax_rate=@tax_rate,
         track_inv=@track_inv, active=@active`,
    );
    const tx = this.db.transaction((rows: ProductSnapshot[]) => {
      for (const p of rows) {
        stmt.run({
          id: p.id,
          sku: p.sku,
          name: p.name,
          barcode: p.barcode ?? null,
          category: p.category,
          price_minor: p.priceMinorUnits,
          currency: p.currency,
          tax_rate: p.taxRatePercent,
          track_inv: p.trackInventory ? 1 : 0,
          active: p.active ? 1 : 0,
        });
      }
    });
    tx(products);
  }

  listAll(): ProductSnapshot[] {
    const rows = this.db.prepare('SELECT * FROM products WHERE active = 1').all() as Record<string, unknown>[];
    return rows.map(rowToProduct);
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n;
  }
}

function rowToProduct(r: Record<string, unknown>): ProductSnapshot {
  return {
    id: r.id as string,
    sku: r.sku as string,
    name: r.name as string,
    barcode: (r.barcode as string) ?? undefined,
    category: r.category as string,
    priceMinorUnits: r.price_minor as number,
    currency: r.currency as string,
    taxRatePercent: r.tax_rate as number,
    trackInventory: (r.track_inv as number) === 1,
    active: (r.active as number) === 1,
  };
}

export interface CommittedSaleRow {
  id: string;
  status: string;
  currency: string;
  storeId: string;
  deviceId: string;
  customerId?: string;
  totalMinorUnits: number;
  snapshot: unknown;
  committedAt: string;
}

/** Persist committed sales — the local source of truth until synced. */
export class SaleRepository {
  constructor(private readonly db: Db) {}

  insert(sale: CommittedSaleRow): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO sales (id, status, currency, store_id, device_id, customer_id, total_minor, snapshot, committed_at, synced)
         VALUES (@id, @status, @currency, @store_id, @device_id, @customer_id, @total_minor, @snapshot, @committed_at, 0)`,
      )
      .run({
        id: sale.id,
        status: sale.status,
        currency: sale.currency,
        store_id: sale.storeId,
        device_id: sale.deviceId,
        customer_id: sale.customerId ?? null,
        total_minor: sale.totalMinorUnits,
        snapshot: JSON.stringify(sale.snapshot),
        committed_at: sale.committedAt,
      });
  }

  markSynced(saleId: string): void {
    this.db.prepare('UPDATE sales SET synced = 1 WHERE id = ?').run(saleId);
  }

  countUnsynced(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM sales WHERE synced = 0').get() as { n: number }).n;
  }
}
