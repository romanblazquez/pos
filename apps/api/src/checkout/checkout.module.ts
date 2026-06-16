import { Module } from '@nestjs/common';
import { PrismaModule } from '@retail-os/db-postgres';
import { CheckoutService } from './checkout.service.js';
import { CheckoutController } from './checkout.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
