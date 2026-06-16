import { Module } from '@nestjs/common';
import { PrismaModule } from '@retail-os/db-postgres';
import { CheckoutService } from './checkout.service.js';
import { CheckoutController } from './checkout.controller.js';
import { MpSellerOAuthService } from './mp-seller-oauth.service.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';

@Module({
  imports: [PrismaModule, LoyaltyModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, MpSellerOAuthService],
  exports: [CheckoutService, MpSellerOAuthService],
})
export class CheckoutModule {}
