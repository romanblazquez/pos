import type { SaleIngestionRequest, SaleIngestionResponse } from '@retail-os/shared-types';

/**
 * SyncTarget — port to the central API's ingestion endpoint. The engine pushes
 * outbox messages through this; production uses {@link HttpSyncTarget}, tests use
 * an in-memory implementation. Idempotency is enforced server-side via
 * `idempotencyKey`, so re-delivering after a flaky network is always safe.
 */
export interface SyncTarget {
  pushSale(req: SaleIngestionRequest): Promise<SaleIngestionResponse>;
}

export class HttpSyncTarget implements SyncTarget {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly authToken?: string,
  ) {}

  async pushSale(req: SaleIngestionRequest): Promise<SaleIngestionResponse> {
    const res = await this.fetchFn(`${this.baseUrl}/sync/sales`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': req.idempotencyKey,
        ...(this.authToken ? { authorization: `Bearer ${this.authToken}` } : {}),
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Sync failed: HTTP ${res.status}`);
    return (await res.json()) as SaleIngestionResponse;
  }
}

/** In-memory target for offline development and tests. */
export class InMemorySyncTarget implements SyncTarget {
  readonly received: SaleIngestionRequest[] = [];
  /** When true, the next push throws to exercise retry/backoff. */
  failNext = false;

  async pushSale(req: SaleIngestionRequest): Promise<SaleIngestionResponse> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Simulated network failure');
    }
    // De-dupe on idempotency key (mimic the server).
    if (!this.received.some((r) => r.idempotencyKey === req.idempotencyKey)) {
      this.received.push(req);
    }
    return { accepted: true, saleId: (req.sale as { saleId: string }).saleId, serverReceivedAt: new Date().toISOString() };
  }
}
