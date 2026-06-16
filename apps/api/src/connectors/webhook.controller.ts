import { Body, Controller, Headers, HttpCode, Inject, Logger, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
