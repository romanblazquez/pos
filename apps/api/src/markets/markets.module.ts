import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller.js';
import { TenantMarketsController } from './tenant-markets.controller.js';
import { SellerMarketsController } from './seller-markets.controller.js';
import { MarketsService } from './markets.service.js';

@Module({
  controllers: [MarketsController, TenantMarketsController, SellerMarketsController],
  providers: [MarketsService],
  exports: [MarketsService],
})
export class MarketsModule {}
