import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller.js';
import { SellersService } from './sellers.service.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';

@Module({
  imports: [LoyaltyModule],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
