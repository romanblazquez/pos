import { Module } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service.js';
import { LoyaltyController } from './loyalty.controller.js';

@Module({
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
