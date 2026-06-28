import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import type { SaleIngestionRequest, SaleIngestionResponse } from '@retail-os/shared-types';
import { SyncService } from './sync.service.js';
import { Roles } from '../auth/auth.guard.js';

/**
 * Sync ingestion endpoint — the central counterpart of the edge sync-engine.
 * Idempotent by the `Idempotency-Key` header (the outbox message id), so a
 * terminal re-delivering after a flaky network never creates a duplicate sale.
 * Implements the contract in `docs/api-spec.md`.
 */
@Roles('admin', 'service')
@Controller('sync')
export class SyncController {
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}

  @Post('sales')
  ingestSale(
    @Body() body: SaleIngestionRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<SaleIngestionResponse> {
    return this.sync.ingest(body, idempotencyKey ?? body.idempotencyKey);
  }
}
