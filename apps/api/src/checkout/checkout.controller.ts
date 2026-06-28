import {
  Body, Controller, Get, Param, Post, Inject, Query, Headers, Redirect, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service.js';
import { InitCheckoutDto, CheckoutResultDto } from './checkout.dto.js';
import { MpSellerOAuthService } from './mp-seller-oauth.service.js';
import { Public, Roles } from '../auth/auth.guard.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.js';

const SELLER_PORTAL_URL = process.env.SELLER_PORTAL_URL ?? 'http://localhost:4400';

@ApiTags('checkout')
@Controller('api/v1')
export class CheckoutController {
  constructor(
    @Inject(CheckoutService)       private readonly svc: CheckoutService,
    @Inject(MpSellerOAuthService)  private readonly mpOAuth: MpSellerOAuthService,
  ) {}

  // ── Checkout ────────────────────────────────────────────────────────────────

  /** Validate cart, create order, return MP Checkout Pro URL. */
  @Post('checkout')
  @Roles('customer')
  @ApiOperation({
    summary: 'Initiate checkout and get MercadoPago payment URL',
    description:
      'Validates the cart (checks stock and locks reservation), creates a MarketplaceOrder in `pending` status, then builds a MercadoPago Checkout Pro preference. Returns the MP redirect URL. Redirect the buyer to `checkoutUrl` to complete payment. The order is confirmed asynchronously via the MercadoPago webhook once payment succeeds.',
  })
  @ApiBody({ type: InitCheckoutDto })
  @ApiResponse({ status: 201, description: 'Order created. Returns { orderId, checkoutUrl, totalMinorUnits }', type: CheckoutResultDto })
  @ApiResponse({ status: 400, description: 'Validation failed — e.g. insufficient stock, unknown listingId, cart spans more than one seller, or empty cart' })
  @ApiResponse({ status: 409, description: 'Stock reservation conflict — another buyer reserved the last unit' })
  initCheckout(@Body() dto: InitCheckoutDto, @Req() req: Request & { user: JwtPayload }) {
    return this.svc.initCheckout({
      ...dto,
      customerId: req.user.customerId,
      customerEmail: req.user.email,
    });
  }

  /** Get order status (polled by frontend after payment redirect). */
  @Get('checkout/orders/:id')
  @Roles('customer')
  @ApiOperation({
    summary: 'Get order status by ID',
    description:
      'Poll this endpoint after the buyer returns from MercadoPago to check if payment was captured. Status progresses: pending → reserved → confirmed → shipped → delivered. Returns full order with line items.',
  })
  @ApiParam({ name: 'id', description: 'Order CUID returned by POST /checkout', example: 'clxorder789' })
  @ApiResponse({ status: 200, description: 'Order found. Includes status, totals, lines, and events.' })
  @ApiResponse({ status: 404, description: 'No order with this ID' })
  getOrder(@Param('id') id: string, @Req() req: Request & { user: JwtPayload }) {
    return this.svc.getCustomerOrder(id, req.user.customerId!);
  }

  /** Force-reconcile an order against the MP Payments Search API. */
  @Post('checkout/orders/:id/reconcile')
  @Roles('customer')
  @ApiOperation({
    summary: 'Force-reconcile an order against MercadoPago',
    description:
      'Queries the MercadoPago Payments Search API for payments linked to this order and updates its status accordingly. Use this if the webhook was not received or the order is stuck in `pending`. Idempotent — safe to call multiple times.',
  })
  @ApiParam({ name: 'id', example: 'clxorder789' })
  @ApiResponse({ status: 200, description: 'Reconciliation complete. Returns updated order status.' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async reconcileOrder(@Param('id') id: string, @Req() req: Request & { user: JwtPayload }) {
    await this.svc.assertCustomerOwnsOrder(id, req.user.customerId!);
    return this.svc.reconcileOrder(id);
  }

  /** Customer: list my orders. */
  @Get('customers/:customerId/orders')
  @Roles('customer', 'admin')
  @ApiOperation({
    summary: 'List orders for a customer',
    description: 'Returns all marketplace orders for the given customer, newest first.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer CUID', example: 'clxcust123' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Array of orders with seller and line info.' })
  listCustomerOrders(
    @Param('customerId') customerId: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listCustomerOrders(customerId, limit ? parseInt(limit, 10) : 20);
  }

  /** Admin: list all orders (most recent first). */
  @ApiTags('admin')
  @Get('checkout/admin/orders')
  @Roles('admin')
  @ApiOperation({
    summary: 'List all orders (admin)',
    description:
      'Returns all marketplace orders across all sellers, newest first. Filter by status to find stuck or failed orders.',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results to return', example: 50 })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by order status: pending | reserved | confirmed | shipped | delivered | cancelled | refunded', example: 'pending' })
  @ApiResponse({ status: 200, description: 'Array of orders with lines and seller info' })
  listOrders(
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listOrders({
      limit: limit ? parseInt(limit, 10) : 50,
      status,
    });
  }

  /** Admin: mark a seller's order payout as sent (manual, outside the platform). */
  @ApiTags('admin')
  @Post('checkout/admin/orders/:orderId/mark-paid-out')
  @Roles('admin')
  @ApiOperation({
    summary: "Mark a seller's payout for this order as sent (admin)",
    description:
      'Stopgap while sellers cannot connect their own MercadoPago account for real-time split ' +
      "payments — the platform collects 100% of every payment. Use this once you've manually " +
      "transferred the seller's net amount (order total minus commission) outside the platform.",
  })
  @ApiParam({ name: 'orderId', description: 'MarketplaceOrder CUID' })
  @ApiBody({ schema: { type: 'object', properties: { paidOutBy: { type: 'string', example: 'admin@retailos.com' } } }, required: false })
  @ApiResponse({ status: 201, description: 'Order marked as paid out.' })
  @ApiResponse({ status: 400, description: 'Order payment is not confirmed yet — nothing to pay out.' })
  markPaidOut(@Param('orderId') orderId: string, @Req() req: Request & { user: JwtPayload }) {
    return this.svc.markPaidOut(orderId, req.user.email);
  }

  /** Admin: undo a payout mark (correcting a mistake). */
  @ApiTags('admin')
  @Post('checkout/admin/orders/:orderId/unmark-paid-out')
  @Roles('admin')
  @ApiOperation({ summary: 'Undo a payout mark (admin)' })
  @ApiParam({ name: 'orderId', description: 'MarketplaceOrder CUID' })
  @ApiResponse({ status: 201, description: 'Payout mark cleared.' })
  unmarkPaidOut(@Param('orderId') orderId: string) {
    return this.svc.unmarkPaidOut(orderId);
  }

  /** MercadoPago Checkout Pro payment webhook. */
  @Post('checkout/webhooks/mercadopago')
  @Public()
  @ApiOperation({
    summary: 'MercadoPago payment notification webhook',
    description:
      'Receives IPN (Instant Payment Notification) events from MercadoPago when a payment status changes. Verifies the HMAC signature using the x-signature and x-request-id headers, then fetches payment details and updates the corresponding order. Always returns HTTP 200 — any non-200 causes MP to retry. Do not call this endpoint directly.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'payment' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1234567890' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Webhook received and queued for processing' })
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
  @Roles('seller', 'admin')
  @ApiOperation({
    summary: 'Get MercadoPago OAuth authorization URL',
    description:
      'Returns the URL to redirect the seller to for MercadoPago OAuth. After authorization, MP redirects to /payments/mp/oauth/callback which saves encrypted tokens for split payments.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clxseller123' })
  @ApiResponse({ status: 200, description: 'Returns { authUrl: string } — redirect seller browser to this URL' })
  async getMpAuthUrl(@Param('sellerId') sellerId: string) {
    return { authUrl: await this.mpOAuth.getAuthUrl(sellerId) };
  }

  /** Get MP connection status for a seller. */
  @Get('sellers/:sellerId/payments/mp/status')
  @Roles('seller', 'admin')
  @ApiOperation({
    summary: 'Check MercadoPago connection status',
    description:
      'Returns whether the seller has connected their MercadoPago account for marketplace split payments, and their MP merchant ID if connected.',
  })
  @ApiParam({ name: 'sellerId', example: 'clxseller123' })
  @ApiResponse({ status: 200, description: 'Returns { connected: boolean, merchantId?: string }' })
  getMpStatus(@Param('sellerId') sellerId: string) {
    return this.mpOAuth.getConnectionStatus(sellerId);
  }

  /**
   * MP OAuth callback — MP redirects here after the seller authorises.
   * Exchanges code, saves encrypted tokens, redirects seller back to portal.
   */
  @Get('payments/mp/oauth/callback')
  @Public()
  @Redirect()
  @ApiOperation({
    summary: 'MercadoPago OAuth redirect callback',
    description:
      'Redirect target registered with MercadoPago. Exchanges the authorization code for access/refresh tokens, encrypts them with AES-256-GCM, and saves them to the seller\'s record. Redirects to the seller portal with ?mp=success or ?mp=error. Do not call directly.',
  })
  @ApiQuery({ name: 'code', required: false, description: 'Authorization code from MP' })
  @ApiQuery({ name: 'state', required: false, description: 'Opaque state param — contains sellerId for routing' })
  @ApiQuery({ name: 'error', required: false, description: 'Present when the seller denied authorization' })
  @ApiResponse({ status: 302, description: 'Redirects to seller portal' })
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
