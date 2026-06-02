import { Body, Controller, Headers, Post } from '@nestjs/common';
import type { SaleIngestionRequest, SaleIngestionResponse } from '@retail-os/shared-types';
import { SyncService } from './sync.service.js';

/**
 * Sync ingestion endpoint — the central counterpart of the edge sync-engine.
 * Idempotent by the `Idempotency-Key` header (the outbox message id), so a
 * terminal re-delivering after a flaky network never creates a duplicate sale.
 * Implements the contract in `docs/api-spec.md`.
 */
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('sales')
  ingestSale(
    @Body() body: SaleIngestionRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): SaleIngestionResponse {
    return this.sync.ingest(body, idempotencyKey ?? body.idempotencyKey);
  }
}
