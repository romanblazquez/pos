import { Module } from '@nestjs/common';
import { MktCatalogController } from './mkt-catalog.controller.js';
import { MktCatalogService } from './mkt-catalog.service.js';
import { BggService } from './bgg.service.js';
import { BggScraperClientService } from './bgg-scraper-client.service.js';
import { BggDiscoveryService } from './bgg-discovery.service.js';

@Module({
  controllers: [MktCatalogController],
  providers: [MktCatalogService, BggService, BggScraperClientService, BggDiscoveryService],
  exports: [MktCatalogService],
})
export class MktCatalogModule {}
