import { Module } from '@nestjs/common';
import { ConnectorRegistryService } from './connector-registry.service.js';
import { ConnectorSyncService } from './sync.service.js';
import { ProductMatchingService } from './product-matching.service.js';
import { SyncSchedulerService } from './sync-scheduler.service.js';
import { ConnectorsController } from './connectors.controller.js';
import { WebhookController } from './webhook.controller.js';
import { MktCatalogModule } from '../mkt-catalog/mkt-catalog.module.js';
import { SellersModule } from '../sellers/sellers.module.js';

@Module({
  imports: [MktCatalogModule, SellersModule],
  controllers: [ConnectorsController, WebhookController],
  providers: [ConnectorRegistryService, ConnectorSyncService, ProductMatchingService, SyncSchedulerService],
  exports: [ConnectorRegistryService, ConnectorSyncService, ProductMatchingService, SyncSchedulerService],
})
export class ConnectorsModule {}
