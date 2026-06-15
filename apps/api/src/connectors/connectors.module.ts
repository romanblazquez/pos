import { Module } from '@nestjs/common';
import { ConnectorRegistryService } from './connector-registry.service.js';
import { ConnectorSyncService } from './sync.service.js';
import { ConnectorsController } from './connectors.controller.js';
import { MktCatalogModule } from '../mkt-catalog/mkt-catalog.module.js';

@Module({
  imports: [MktCatalogModule],
  controllers: [ConnectorsController],
  providers: [ConnectorRegistryService, ConnectorSyncService],
  exports: [ConnectorRegistryService, ConnectorSyncService],
})
export class ConnectorsModule {}
