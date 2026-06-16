import {
  Body, Controller, Get, Param, Post, Inject, Query, Headers, Redirect,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CheckoutService, InitCheckoutDto } from './checkout.service.js';
import { MpSellerOAuthService } from './mp-seller-oauth.service.js';
import { Public } from '../auth/auth.guard.js';

const SELLER_PORTAL_URL = process.env.SELLER_PORTAL_URL ?? 'http://localhost:4400';

@ApiTags('checkout')
@Public()
@Controller('api/v1')
export class CheckoutController {
  constructor(
    @Inject(CheckoutService)       private readonly svc: CheckoutService,
    @Inject(MpSellerOAuthService)  private readonly mpOAuth: MpSellerOAuthService,
  ) {}

  // ── Checkout ────────────────────────────────────────────────────────────────

  /** Validate cart, create order, return MP Checkout Pro URL. */
  @Post('checkout')
  initCheckout(@Body() dto: InitCheckoutDto) {
    return this.svc.initCheckout(dto);
  }

  /** Get order status (polled by frontend after payment redirect). */
  @Get('checkout/orders/:id')
  getOrder(@Param('id') id: string) {
    return this.svc.getOrder(id);
  }

  /** Force-reconcile an order against the MP Payments Search API. */
  @Post('checkout/orders/:id/reconcile')
  reconcileOrder(@Param('id') id: string) {
    return this.svc.reconcileOrder(id);
  }

  /** Admin: list all orders (most recent first). */
  @ApiTags('admin')
  @Get('checkout/admin/orders')
  listOrders(
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listOrders({
      limit: limit ? parseInt(limit, 10) : 50,
      status,
    });
  }

  /** MercadoPago Checkout Pro payment webhook. */
  @Post('checkout/webhooks/mercadopago')
  handleWebhook(
    @Body() body: { type: string; data: { id: string } },
    @Headers('x-signature') xSignature?: string,
    @Headers('x-request-id') xRequestId?: string,
  ) {
    this.svc.verifyWebhookSignature(xSignature, xRequestId, body.data?.id ?? '');
    return this.svc.handlePaymentWebhook(body);
  }

  // ── Seller MP OAuth ─────────────────────────────────────────────────────────

  /** Return the MP OAuth authorization URL so the seller can connect their account. */
  @Get('sellers/:sellerId/payments/mp/connect')
  getMpAuthUrl(@Param('sellerId') sellerId: string) {
    return { authUrl: this.mpOAuth.getAuthUrl(sellerId) };
  }

  /** Get MP connection status for a seller. */
  @Get('sellers/:sellerId/payments/mp/status')
  getMpStatus(@Param('sellerId') sellerId: string) {
    return this.mpOAuth.getConnectionStatus(sellerId);
  }

  /**
   * MP OAuth callback — MP redirects here after the seller authorises.
   * Exchanges code, saves encrypted tokens, redirects seller back to portal.
   */
  @Get('payments/mp/oauth/callback')
  @Redirect()
  async mpOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      return {
        url: `${SELLER_PORTAL_URL}?mp=error&msg=${encodeURIComponent(error)}`,
        statusCode: 302,
      };
    }
    try {
      const sellerId = await this.mpOAuth.exchangeCode(code, state);
      return {
        url: `${SELLER_PORTAL_URL}?mp=success&seller=${sellerId}`,
        statusCode: 302,
      };
    } catch (err) {
      return {
        url: `${SELLER_PORTAL_URL}?mp=error&msg=${encodeURIComponent(String(err))}`,
        statusCode: 302,
      };
    }
  }
}
