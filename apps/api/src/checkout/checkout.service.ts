import { Injectable, Inject, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '@retail-os/db-postgres';

const MP_BASE = 'https://api.mercadopago.com';

export interface CartItem {
  listingId: string;
  quantity: number;
}

export interface CheckoutAddressDto {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface InitCheckoutDto {
  items: CartItem[];
  deliveryAddress: CheckoutAddressDto;
  customerId?: string;
  customerEmail: string;
  customerName: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
}

export interface CheckoutResult {
  orderId: string;
  checkoutUrl: string;        // MP Checkout Pro URL
  checkoutSessionId: string;  // MP preference_id
  expiresAt: string;
}

@Injectable()
export class CheckoutService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async initCheckout(dto: InitCheckoutDto): Promise<CheckoutResult> {
    // 1. Load and validate all listings
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: dto.items.map((i) => i.listingId) }, active: true },
      include: {
        product: { select: { name: true, slug: true, images: true } },
        seller: { select: { id: true, name: true } },
      },
    });

    if (listings.length !== dto.items.length) {
      const found = new Set(listings.map((l) => l.id));
      const missing = dto.items.filter((i) => !found.has(i.listingId)).map((i) => i.listingId);
      throw new NotFoundException(`Listings not found or inactive: ${missing.join(', ')}`);
    }

    // 2. Validate stock
    for (const item of dto.items) {
      const listing = listings.find((l) => l.id === item.listingId)!;
      if (listing.stockStatus === 'out_of_stock') {
        throw new BadRequestException(
          `"${listing.product.name}" está agotado. Por favor eliminalo del carrito.`,
        );
      }
      if (listing.stock > 0 && listing.stock < item.quantity) {
        throw new BadRequestException(
          `Solo quedan ${listing.stock} unidades de "${listing.product.name}".`,
        );
      }
    }

    // 3. All items must be from a single seller (MVP constraint)
    const sellerIds = [...new Set(listings.map((l) => l.sellerId))];
    if (sellerIds.length > 1) {
      throw new BadRequestException(
        'Por ahora solo podés comprar productos del mismo vendedor en un solo pedido.',
      );
    }
    const sellerId = sellerIds[0];

    // 4. Calculate totals
    const itemMap = new Map(dto.items.map((i) => [i.listingId, i.quantity]));
    let subtotal = 0;
    for (const listing of listings) {
      subtotal += listing.priceMinorUnits * (itemMap.get(listing.id) ?? 1);
    }
    const currency = listings[0].currency;

    // 5. Create pending order
    const order = await this.prisma.marketplaceOrder.create({
      data: {
        sellerId,
        customerId: dto.customerId ?? null,
        status: 'pending',
        currency,
        subtotalMinorUnits: subtotal,
        shippingMinorUnits: 0,
        totalMinorUnits: subtotal,
        deliveryAddress: dto.deliveryAddress,
        lines: {
          create: listings.map((l) => ({
            listingId: l.id,
            quantity: itemMap.get(l.id) ?? 1,
            unitPriceMinor: l.priceMinorUnits,
            lineTotalMinor: l.priceMinorUnits * (itemMap.get(l.id) ?? 1),
          })),
        },
        events: {
          create: { type: 'created', payload: { initiatedBy: dto.customerEmail } },
        },
      },
    });

    // 6. Create MercadoPago Checkout Pro preference
    const preference = await this.createMpPreference({
      orderId: order.id,
      items: listings.map((l) => ({
        id: l.id,
        title: l.product.name,
        quantity: itemMap.get(l.id) ?? 1,
        unit_price: l.priceMinorUnits / 100,
        currency_id: currency === 'MXN' ? 'MXN' : 'ARS',
        picture_url: l.product.images[0] ?? '',
      })),
      payer: { email: dto.customerEmail, name: dto.customerName },
      successUrl: dto.successUrl,
      failureUrl: dto.failureUrl,
      pendingUrl: dto.pendingUrl,
    });

    // 7. Attach preference ID to order
    await this.prisma.marketplaceOrder.update({
      where: { id: order.id },
      data: {
        checkoutSessionId: preference.id,
        paymentProvider: 'mercadopago_checkout_pro',
      },
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return {
      orderId: order.id,
      checkoutUrl: preference.init_point,
      checkoutSessionId: preference.id,
      expiresAt,
    };
  }

  /**
   * Verify MercadoPago webhook signature.
   * Header format: "ts=<unix_ts>,v1=<hmac_sha256_hex>"
   * Manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
   */
  verifyWebhookSignature(
    xSignature: string | undefined,
    xRequestId: string | undefined,
    dataId: string,
  ): void {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) return; // skip verification in dev when secret not set

    if (!xSignature) throw new UnauthorizedException('Missing x-signature header');

    const parts = Object.fromEntries(
      xSignature.split(',').map((p) => p.split('=')),
    ) as Record<string, string>;
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) throw new UnauthorizedException('Malformed x-signature');

    const manifest = `id:${dataId};request-id:${xRequestId ?? ''};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    if (expected !== v1) throw new UnauthorizedException('Webhook signature mismatch');
  }

  /** Force-reconcile an order against the MP Payments Search API. */
  async reconcileOrder(orderId: string): Promise<{ status: string; updated: boolean }> {
    const order = await this.prisma.marketplaceOrder.findUniqueOrThrow({
      where: { id: orderId },
    });

    if (order.status !== 'pending') {
      return { status: order.status, updated: false };
    }

    if (!this.mpToken) {
      return { status: order.status, updated: false };
    }

    // Search MP for payments with this order as external_reference
    const res = await fetch(
      `${MP_BASE}/v1/payments/search?external_reference=${orderId}&sort=date_created&criteria=desc&range=date_created&begin_date=NOW-1HOURS&end_date=NOW`,
      { headers: { Authorization: `Bearer ${this.mpToken}` } },
    );

    if (!res.ok) return { status: order.status, updated: false };

    const { results } = (await res.json()) as { results: Array<{ id: number; status: string; transaction_amount: number }> };
    const latest = results?.[0];
    if (!latest) return { status: order.status, updated: false };

    const statusMap: Record<string, string> = {
      approved: 'confirmed',
      rejected: 'cancelled',
      cancelled: 'cancelled',
    };
    const newStatus = statusMap[latest.status];
    if (!newStatus || newStatus === order.status) return { status: order.status, updated: false };

    await this.prisma.marketplaceOrder.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        paymentId: String(latest.id),
        events: {
          create: {
            type: `reconciled_${latest.status}`,
            payload: { paymentId: latest.id, mpStatus: latest.status, amount: latest.transaction_amount },
          },
        },
      },
    });

    return { status: newStatus, updated: true };
  }

  async handlePaymentWebhook(payload: {
    type: string;
    data: { id: string };
  }): Promise<{ processed: boolean }> {
    if (payload.type !== 'payment') return { processed: false };

    const paymentId = payload.data.id;
    const payment = await this.fetchMpPayment(paymentId);
    if (!payment) return { processed: false };

    const orderId = payment.external_reference as string | undefined;
    if (!orderId) return { processed: false };

    const order = await this.prisma.marketplaceOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) return { processed: false };

    const statusMap: Record<string, string> = {
      approved: 'confirmed',
      rejected: 'cancelled',
      cancelled: 'cancelled',
      refunded: 'refunded',
    };

    const newStatus = statusMap[payment.status] ?? order.status;

    await this.prisma.marketplaceOrder.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        paymentId,
        events: {
          create: {
            type: `payment_${payment.status}`,
            payload: { paymentId, mpStatus: payment.status, amount: payment.transaction_amount },
          },
        },
      },
    });

    return { processed: true };
  }

  async listOrders(params: { limit?: number; status?: string } = {}) {
    const { limit = 50, status } = params;
    const [orders, total] = await Promise.all([
      this.prisma.marketplaceOrder.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          seller: { select: { name: true } },
          customer: { select: { email: true } },
        },
      }),
      this.prisma.marketplaceOrder.count({
        where: status ? { status } : undefined,
      }),
    ]);
    return { orders, total };
  }

  async getOrder(orderId: string) {
    return this.prisma.marketplaceOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            listing: {
              include: { product: { select: { name: true, slug: true, images: true } } },
            },
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
        seller: { select: { name: true, slug: true } },
      },
    });
  }

  // ── MercadoPago helpers ────────────────────────────────────────────────────

  private get mpToken() {
    return process.env.MERCADOPAGO_ACCESS_TOKEN ?? '';
  }

  private async createMpPreference(params: {
    orderId: string;
    items: Array<{
      id: string; title: string; quantity: number;
      unit_price: number; currency_id: string; picture_url: string;
    }>;
    payer: { email: string; name: string };
    successUrl: string;
    failureUrl: string;
    pendingUrl: string;
  }): Promise<{ id: string; init_point: string }> {
    if (!this.mpToken) {
      // Dev mode: return a fake preference so the rest of the flow can be tested
      return {
        id: `dev-pref-${params.orderId}`,
        init_point: `${params.successUrl}?order_id=${params.orderId}&dev_mode=1`,
      };
    }

    const body = {
      external_reference: params.orderId,
      items: params.items,
      payer: params.payer,
      back_urls: {
        success: params.successUrl,
        failure: params.failureUrl,
        pending: params.pendingUrl,
      },
      auto_return: 'approved',
      notification_url: `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/v1/checkout/webhooks/mercadopago`,
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    const res = await fetch(`${MP_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.mpToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new BadRequestException(`MercadoPago preference error: ${err}`);
    }

    return res.json() as Promise<{ id: string; init_point: string }>;
  }

  private async fetchMpPayment(paymentId: string): Promise<{
    status: string;
    external_reference: unknown;
    transaction_amount: number;
  } | null> {
    if (!this.mpToken) return null;

    const res = await fetch(`${MP_BASE}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${this.mpToken}` },
    });

    if (!res.ok) return null;
    return res.json() as Promise<{ status: string; external_reference: unknown; transaction_amount: number }>;
  }
}
