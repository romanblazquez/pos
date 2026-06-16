import { Module } from '@nestjs/common';
import { PrismaModule } from '@retail-os/db-postgres';
import { CheckoutService } from './checkout.service.js';
import { CheckoutController } from './checkout.controller.js';
import { MpSellerOAuthService } from './mp-seller-oauth.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, MpSellerOAuthService],
  exports: [CheckoutService, MpSellerOAuthService],
})
export class CheckoutModule {}
