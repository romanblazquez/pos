import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller.js';
import { SellersService } from './sellers.service.js';
import { SellerMappingService } from './seller-mapping.service.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { AiModule } from '../ai/ai.module.js';
import { MktCatalogModule } from '../mkt-catalog/mkt-catalog.module.js';
import { CheckoutModule } from '../checkout/checkout.module.js';
import { RankingsModule } from '../rankings/rankings.module.js';

@Module({
  imports: [LoyaltyModule, AiModule, MktCatalogModule, CheckoutModule, RankingsModule],
  controllers: [SellersController],
  providers: [SellersService, SellerMappingService],
  exports: [SellersService, SellerMappingService],
})
export class SellersModule {}
