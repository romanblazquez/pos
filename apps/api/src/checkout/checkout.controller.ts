import {
  Body, Controller, Get, Param, Post, Inject,
} from '@nestjs/common';
import { CheckoutService, InitCheckoutDto } from './checkout.service.js';
import { Public } from '../auth/auth.guard.js';

@Public()
@Controller('api/v1/checkout')
export class CheckoutController {
  constructor(@Inject(CheckoutService) private readonly svc: CheckoutService) {}

  /** Validate cart, create order, return MP Checkout Pro URL. */
  @Post()
  initCheckout(@Body() dto: InitCheckoutDto) {
    return this.svc.initCheckout(dto);
  }

  /** Get order status (polled by frontend after payment redirect). */
  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.svc.getOrder(id);
  }

  /** MercadoPago Checkout Pro payment webhook. */
  @Post('webhooks/mercadopago')
  handleWebhook(@Body() body: { type: string; data: { id: string } }) {
    return this.svc.handlePaymentWebhook(body);
  }
}
