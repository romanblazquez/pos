import { Module } from '@nestjs/common';
import { SyncController } from './sync/sync.controller.js';
import { SyncService } from './sync/sync.service.js';
import { HealthController } from './health/health.controller.js';

/**
 * Root module of the Retail OS modular monolith. Each bounded context becomes a
 * NestJS feature module here (sync, catalog, sales, payments, reports, auth …) —
 * the module boundary mirrors the domain boundary, so a context can later be
 * extracted into its own service behind the same contracts.
 */
@Module({
  imports: [],
  controllers: [SyncController, HealthController],
  providers: [SyncService],
})
export class AppModule {}
