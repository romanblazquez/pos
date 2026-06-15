import { Module } from '@nestjs/common';
import { MktCatalogController } from './mkt-catalog.controller.js';
import { MktCatalogService } from './mkt-catalog.service.js';
import { BggService } from './bgg.service.js';

@Module({
  controllers: [MktCatalogController],
  providers: [MktCatalogService, BggService],
  exports: [MktCatalogService],
})
export class MktCatalogModule {}
