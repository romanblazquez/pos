import { Body, Controller, Headers, HttpCode, Inject, Logger, Param, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { Public } from '../auth/auth.guard.js';
import { ConnectorSyncService } from './sync.service.js';
import { PrismaService } from '@retail-os/db-postgres';

/**
 * Receives real-time push events from external connectors.
 *
 * Tiendanube fires `product/updated` and `product/deleted` events
 * with the full product payload so we can update a single listing
 * without fetching the entire catalog.
 */
@ApiTags('webhooks')
@Public()
@Controller('api/v1/webhooks')
export class WebhookController {
  private readonly log = new Logger(WebhookController.name);

  constructor(
    @Inject(PrismaService)        private readonly prisma: PrismaService,
    @Inject(ConnectorSyncService) private readonly sync: ConnectorSyncService,
  ) {}

  /**
   * Tiendanube webhook endpoint.
   * URL registered per-seller: /api/v1/webhooks/tiendanube/:sellerId
   *
   * Tiendanube sends the User-Agent "TiendaNube/Webhooks" and a JSON body
   * with { store_id, event, product: { id, ... } }.
   */
  @Post('tiendanube/:sellerId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Receive real-time product events from Tiendanube',
    description:
      'Webhook endpoint called by Tiendanube\'s webhook system when a product is created, updated, or deleted. ' +
      'This endpoint is NOT intended to be called directly by API consumers — it is the callback URL ' +
      'registered per-seller via the `webhook/register` endpoint. ' +
      '\n\n' +
      'Tiendanube identifies itself with the `User-Agent: TiendaNube/Webhooks` header. ' +
      'Requests from unexpected User-Agents are rejected (returns `{ ok: false }`) but still ' +
      'return HTTP 200 to prevent Tiendanube from retrying. ' +
      '\n\n' +
      'For `product/updated` and `product/created` events, if the payload contains variant data ' +
      'the listing is updated in-place (stock, price, stockStatus). ' +
      'If no variant data is present, a targeted incremental catalog sync is triggered. ' +
      'For `product/deleted` events, the matching listing is deactivated. ' +
      '\n\n' +
      'Always returns HTTP 200 with `{ ok: boolean }`. Non-200 responses cause Tiendanube to retry ' +
      'with exponential backoff, so errors are swallowed after logging.',
  })
  @ApiParam({
    name: 'sellerId',
    description: 'Seller CUID — identifies which seller\'s listings to update.',
    example: 'clx1abc2def3ghi4jkl',
  })
  @ApiHeader({
    name: 'User-Agent',
    description: 'Must contain "TiendaNube" or "tiendanube". Requests from other agents are rejected.',
    example: 'TiendaNube/Webhooks',
    required: false,
  })
  @ApiBody({
    description: 'Tiendanube webhook payload. The `product` field contains a partial product object.',
    schema: {
      type: 'object',
      properties: {
        store_id: { type: 'integer', example: 123456 },
        event: {
          type: 'string',
          description: 'Event type. One of: product/updated | product/deleted | product/created',
          example: 'product/updated',
        },
        product: {
          type: 'object',
          properties: {
            id:        { type: 'integer', example: 987654 },
            published: { type: 'boolean', example: true },
            variants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id:               { type: 'integer', example: 1 },
                  price:            { type: 'string',  example: '19.99' },
                  stock:            { type: 'integer', example: 42, nullable: true },
                  stock_management: { type: 'boolean', example: true },
                  sku:              { type: 'string',  example: 'SKU-001', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Always returns 200 to acknowledge receipt. `ok: true` means the event was processed ' +
      '(or safely skipped). `ok: false` means the request was rejected (e.g. invalid User-Agent) ' +
      'but the 200 status prevents retries.',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
      },
    },
  } as any)
  async tiendanubeWebhook(
    @Param('sellerId') sellerId: string,
    @Body() body: TiendanubeWebhookPayload,
    @Headers('user-agent') ua: string,
  ): Promise<{ ok: boolean }> {
    // Basic origin check — Tiendanube identifies itself via User-Agent.
    // Production environments should also verify an HMAC secret if configured.
    if (ua && !ua.includes('TiendaNube') && !ua.includes('tiendanube')) {
      this.log.warn(`[${sellerId}] Webhook rejected: unexpected User-Agent "${ua}"`);
      return { ok: false };
    }

    const event = body?.event;
    const productId = body?.product?.id ?? body?.id;

    this.log.log(`[${sellerId}] Webhook received: ${event} product=${productId}`);

    if (!event || !productId) return { ok: true };

    try {
      if (event === 'product/deleted') {
        await this.handleProductDeleted(sellerId, String(productId));
      } else if (event === 'product/updated' || event === 'product/created') {
        await this.handleProductUpdated(sellerId, String(productId), body);
      }
    } catch (err) {
      this.log.error(`[${sellerId}] Webhook processing error: ${String(err)}`);
    }

    return { ok: true };
  }

  private async handleProductDeleted(sellerId: string, externalProductId: string): Promise<void> {
    await this.prisma.listing.updateMany({
      where: { sellerId, sellerProductId: externalProductId },
      data: { active: false, lastSyncedAt: new Date() },
    });
    this.log.log(`[${sellerId}] Deactivated listing for deleted product ${externalProductId}`);
  }

  private async handleProductUpdated(
    sellerId: string,
    externalProductId: string,
    body: TiendanubeWebhookPayload,
  ): Promise<void> {
    const variant = body.product?.variants?.[0];
    if (!variant) {
      // No variant data in payload — trigger a targeted catalog sync for this seller.
      // Since the incremental sync uses updated_at_min, this will be very fast.
      await this.sync.syncCatalog(sellerId);
      return;
    }

    const stock = variant.stock_management ? (variant.stock ?? 0) : 999;
    const stockStatus = stock === 0 ? 'out_of_stock' : stock <= 3 ? 'low_stock' : 'in_stock';
    const priceMinorUnits = Math.round(parseFloat(variant.price ?? '0') * 100);

    const updated = await this.prisma.listing.updateMany({
      where: { sellerId, sellerProductId: externalProductId },
      data: {
        stock,
        stockStatus,
        ...(priceMinorUnits > 0 ? { priceMinorUnits } : {}),
        lastSyncedAt: new Date(),
      },
    });

    this.log.log(`[${sellerId}] Updated ${updated.count} listing(s) for product ${externalProductId} — stock=${stock}, price=${priceMinorUnits}`);
  }
}

// ─── Tiendanube webhook payload shape (partial) ───────────────────────────────

interface TnWebhookVariant {
  id: number;
  price?: string;
  stock?: number | null;
  stock_management?: boolean;
  sku?: string | null;
}

interface TnWebhookProduct {
  id: number;
  published?: boolean;
  variants?: TnWebhookVariant[];
}

interface TiendanubeWebhookPayload {
  store_id?: number;
  event?: string;
  id?: number;
  product?: TnWebhookProduct;
}
