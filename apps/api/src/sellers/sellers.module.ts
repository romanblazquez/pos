import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller.js';
import { SellersService } from './sellers.service.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [LoyaltyModule, AiModule],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
