import { Injectable } from '@nestjs/common';
import type { SaleIngestionRequest, SaleIngestionResponse } from '@retail-os/shared-types';

/**
 * SyncService — accepts sales from terminals with exactly-once effect.
 *
 * This scaffold keeps idempotency keys + accepted sales in memory; the
 * production implementation persists via Prisma (`IngestionKey` ledger + `Sale`
 * normalization into `Sale`/`SaleLine`/`Payment`). The HTTP/idempotency contract
 * is final and matches what the edge `SyncEngine` already sends.
 */
@Injectable()
export class SyncService {
  private readonly seenKeys = new Map<string, SaleIngestionResponse>();

  ingest(req: SaleIngestionRequest, idempotencyKey: string): SaleIngestionResponse {
    const existing = this.seenKeys.get(idempotencyKey);
    if (existing) return existing; // replay → original result, no duplicate

    const saleId = (req.sale as { saleId?: string }).saleId ?? 'unknown';
    const response: SaleIngestionResponse = {
      accepted: true,
      saleId,
      serverReceivedAt: new Date().toISOString(),
    };
    // TODO(roadmap): persist within a Prisma transaction:
    //   INSERT IngestionKey(key) ; INSERT Sale + SaleLine[] + Payment[]
    this.seenKeys.set(idempotencyKey, response);
    return response;
  }
}
