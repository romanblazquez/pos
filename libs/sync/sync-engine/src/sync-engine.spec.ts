import { describe, it, expect } from 'vitest';
import { openDatabase, OutboxRepository, SaleRepository } from '@retail-os/local-db';
import { SyncEngine } from './sync-engine.js';
import { InMemorySyncTarget } from './sync-target.js';

function setup() {
  const db = openDatabase(':memory:');
  const outbox = new OutboxRepository(db);
  const sales = new SaleRepository(db);
  const target = new InMemorySyncTarget();
  const engine = new SyncEngine(outbox, sales, target, { deviceId: 'dev-1', baseBackoffMs: 1 });
  return { db, outbox, sales, target, engine };
}

function commitSale(outbox: OutboxRepository, sales: SaleRepository, saleId: string) {
  sales.insert({
    id: saleId,
    status: 'committed',
    currency: 'MXN',
    storeId: 'store-1',
    deviceId: 'dev-1',
    totalMinorUnits: 5800,
    snapshot: { saleId, totals: { grandTotal: { minorUnits: 5800, currency: 'MXN' } } },
    committedAt: new Date().toISOString(),
  });
  outbox.enqueue({
    aggregateId: saleId,
    type: 'sales.SaleCommitted',
    correlationId: 'corr-1',
    payload: { saleId, lineCount: 1 },
  });
}

describe('SyncEngine (offline-first outbox drain)', () => {
  it('delivers committed sales and marks them synced', async () => {
    const { outbox, sales, target, engine } = setup();
    commitSale(outbox, sales, 'sale-1');
    expect(outbox.countPending()).toBe(1);

    const res = await engine.runOnce();
    expect(res.delivered).toBe(1);
    expect(target.received).toHaveLength(1);
    expect(outbox.countPending()).toBe(0);
    expect(sales.countUnsynced()).toBe(0);
  });

  it('keeps the message queued and retries after a network failure', async () => {
    const { outbox, sales, target, engine } = setup();
    commitSale(outbox, sales, 'sale-2');

    target.failNext = true;
    const first = await engine.runOnce();
    expect(first.online).toBe(false);
    expect(outbox.countPending()).toBe(1); // still queued

    // Backoff is 1ms; next cycle succeeds.
    await new Promise((r) => setTimeout(r, 5));
    const second = await engine.runOnce();
    expect(second.delivered).toBe(1);
    expect(outbox.countPending()).toBe(0);
  });
});
