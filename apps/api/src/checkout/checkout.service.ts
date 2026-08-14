import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { MpSellerOAuthService } from './mp-seller-oauth.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { verifyMercadoPagoSignature } from '../common/webhook-signature.js';

const MP_BASE = 'https://api.mercadopago.com';

export interface CartItem {
  listingId: string;
  quantity: number;
}

export interface CheckoutAddressDto {
  street: string;
  city: string;
  state?: string;
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
  // Apply as much of the customer's wallet/store credit as available, capped at
  // the order subtotal — matches what the frontend has always sent (the full
  // available balance or nothing, never a partial amount), just without making
  // the caller compute and pass the numbers itself.
  useCredits?: boolean;
}

export interface CheckoutResult {
  orderId: string;
  checkoutUrl: string;        // MP Checkout Pro URL
  mpPreferenceId: string;
  expiresAt: string;
}

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MpSellerOAuthService) private readonly mpOAuth: MpSellerOAuthService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService,
  ) {}

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

    // 2. Validate stock — check the numeric `stock` directly, not just `stockStatus`.
    // stockStatus is a derived label written independently at several sync sites and
    // can drift from the actual count (e.g. a connector reporting stale status); the
    // count itself is the source of truth and must never be bypassable by a stale label.
    for (const item of dto.items) {
      const listing = listings.find((l) => l.id === item.listingId)!;
      if (listing.stockStatus === 'out_of_stock' || listing.stock <= 0) {
        throw new BadRequestException(
          `"${listing.product.name}" está agotado. Por favor eliminalo del carrito.`,
        );
      }
      if (listing.stock < item.quantity) {
        throw new BadRequestException(
          `Solo quedan ${listing.stock} unidades de "${listing.product.name}".`,
        );
      }
    }

    // 3. All items must be from a single seller — MercadoPago's marketplace split
    // is a documented 1:1 model (one payment, one seller-collector); there is no
    // product that splits a single payment across multiple sellers.
    const sellerIds = [...new Set(listings.map((l) => l.sellerId))];
    if (sellerIds.length > 1) {
      throw new BadRequestException(
        'Solo podés comprar productos de una tienda por pedido. Vaciá el carrito o terminá esta compra antes de agregar productos de otra tienda.',
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

    // 5. Create pending order (credits applied as 0 placeholders — patched right
    // after reservation, since reserving needs a real orderId for the wallet
    // transaction record).
    const order = await this.prisma.marketplaceOrder.create({
      data: {
        sellerId,
        customerId: dto.customerId ?? null,
        status: 'pending',
        currency,
        subtotalMinorUnits: subtotal,
        shippingMinorUnits: 0,
        totalMinorUnits: subtotal,
        deliveryAddress: dto.deliveryAddress as object,
        lines: {
          create: listings.map((l) => ({
            listingId: l.id,
            quantity: itemMap.get(l.id) ?? 1,
            unitPriceMinor: l.priceMinorUnits,
            lineTotalMinor: l.priceMinorUnits * (itemMap.get(l.id) ?? 1),
          })),
        },
        events: { create: { type: 'created', payload: { initiatedBy: dto.customerEmail } } },
      },
    });

    // 5.5 Reserve + immediately deduct wallet credits — atomic with the read, so a
    // second concurrent/sequential checkout can never over-apply the same
    // not-yet-redeemed balance (the previous design only checked balance here and
    // deducted later at confirmation, which let two pending orders both "reserve"
    // the same credits). Refund via loyalty.refundCredits if this order is cancelled.
    let platformCreditsApplied = 0;
    let storeCreditsApplied = 0;
    if (dto.useCredits && dto.customerId) {
      const reserved = await this.loyalty.reserveCredits({
        customerId: dto.customerId,
        sellerId,
        orderId: order.id,
        platformCreditsToUse: subtotal,
        storeCreditsToUse: subtotal,
      });
      platformCreditsApplied = reserved.platformCreditsApplied;
      storeCreditsApplied = reserved.storeCreditsApplied;
      await this.prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: { platformCreditsApplied, storeCreditsApplied },
      });
    }
    const creditsAppliedMinor = platformCreditsApplied + storeCreditsApplied;
    const amountDueMinor = subtotal - creditsAppliedMinor;

    // 5.6 Fully covered by wallet credits — skip MercadoPago entirely, confirm now.
    if (amountDueMinor <= 0) {
      // Fully covered by wallet credits — no real money moved, so no cashback is earned
      // on this order (netPaidMinor = 0). Commission/payout still use the gross subtotal.
      const fees = await this.loyalty.computeOrderFees(sellerId, subtotal, 0);
      await this.prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: {
          status: 'confirmed',
          paymentProvider: 'wallet_credits',
          commissionMinorUnits: fees.commissionMinor,
          platformCashbackMinor: fees.platformCashbackMinor,
          storeCashbackMinor: fees.storeCashbackMinor,
          events: { create: { type: 'confirmed_via_credits', payload: { platformCreditsApplied, storeCreditsApplied } } },
        },
      });
      await this.loyalty.awardCashback({
        customerId: dto.customerId!,
        sellerId,
        orderId: order.id,
        platformCashbackMinor: fees.platformCashbackMinor,
        storeCashbackMinor: fees.storeCashbackMinor,
      });
      return {
        orderId: order.id,
        checkoutUrl: `${dto.successUrl}?order_id=${order.id}`,
        mpPreferenceId: 'wallet-credits',
        expiresAt: new Date().toISOString(),
      };
    }

    // 6. Resolve seller's MP access token for the 1:1 marketplace split. The
    // seller's own OAuth token is what makes MP route their net share directly
    // to their account — fall back to the platform's own token (Merchant of
    // Record, no automatic split) only while the seller hasn't connected yet.
    let sellerMpToken: string | null = null;
    try {
      sellerMpToken = await this.mpOAuth.getSellerAccessToken(sellerId);
    } catch {
      // Seller hasn't connected MP yet — fall back to platform token
    }

    // Commission must reflect the seller's actual configured rate (platform base
    // rate net of their cashback-driven discount), not a hardcoded stand-in —
    // this is exactly the number MP will actually withhold from the seller's
    // payout, so it has to match what computeOrderFees uses for the ledger too.
    const { effectiveCommissionPct } = await this.loyalty.computeOrderFees(sellerId, amountDueMinor, amountDueMinor);
    const commissionAmount = Math.round(amountDueMinor * effectiveCommissionPct) / 100; // major units
    const currencyId = currency === 'MXN' ? 'MXN' : 'ARS';

    // When credits are applied, MercadoPago must charge exactly amountDueMinor —
    // collapse to a single consolidated line item rather than trying to scale each
    // listing's price proportionally (simpler, avoids rounding-cent edge cases).
    const mpItems = creditsAppliedMinor > 0
      ? [{
          id: order.id,
          title: listings.length === 1 ? listings[0].product.name : `Pedido (${listings.length} productos)`,
          quantity: 1,
          unit_price: amountDueMinor / 100,
          currency_id: currencyId,
          picture_url: listings[0].product.images[0] ?? '',
        }]
      : listings.map((l) => ({
          id: l.id,
          title: l.product.name,
          quantity: itemMap.get(l.id) ?? 1,
          unit_price: l.priceMinorUnits / 100,
          currency_id: currencyId,
          picture_url: l.product.images[0] ?? '',
        }));

    // 7. Create MercadoPago Checkout Pro preference
    const preference = await this.createMpPreference({
      orderId: order.id,
      sellerMpToken,
      marketplaceFee: sellerMpToken ? commissionAmount : undefined,
      items: mpItems,
      payer: { email: dto.customerEmail, name: dto.customerName },
      successUrl: dto.successUrl,
      failureUrl: dto.failureUrl,
      pendingUrl: dto.pendingUrl,
    });

    // 8. Attach preference ID to order
    await this.prisma.marketplaceOrder.update({
      where: { id: order.id },
      data: {
        mpPreferenceId: preference.id,
        paymentProvider: 'mercadopago_checkout_pro',
      },
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // MP test/sandbox credentials produce a test-mode preference — sending the buyer
    // to init_point (the production checkout URL) for one triggers a fatal "una de
    // las partes es de prueba" error. Use sandbox_init_point whenever it's present
    // (MP only returns it for test-mode preferences); fall back to init_point for
    // real production credentials, which don't get a sandbox_init_point at all.
    const checkoutUrl = preference.sandbox_init_point ?? preference.init_point;

    return {
      orderId: order.id,
      checkoutUrl,
      mpPreferenceId: preference.id,
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
    verifyMercadoPagoSignature(xSignature, xRequestId, dataId);
  }

  /**
   * Shared finalize step for both reconcile and webhook — this is the single
   * place that applies a payment-status transition's side effects, so the two
   * entry points can never drift or double-apply them.
   *
   * Idempotent by construction: `newStatus === order.status` is a no-op (covers
   * MP's duplicate webhook deliveries and a manual reconcile racing the webhook
   * for the same transition). Compensation (loyalty.refundCredits) mirrors the
   * reservation made at checkout-init (loyalty.reserveCredits) — if the order
   * never completes, the credits go back, same as the saga pattern used for the
   * offline POS checkout (libs/platform/saga): forward step + compensating step.
   */
  private async finalizeOrderStatus(
    order: {
      id: string; sellerId: string; customerId: string | null; status: string;
      totalMinorUnits: number; platformCreditsApplied: number; storeCreditsApplied: number;
    },
    newStatus: string,
    paymentId: string,
    eventType: string,
    eventPayload: Record<string, unknown>,
  ): Promise<boolean> {
    if (newStatus === order.status) return false;

    // Cashback is earned only on money actually collected through the gateway —
    // net of any wallet/store credits redeemed on this order — never on the gross
    // total, or credits could be compounded into more credits for free.
    const netPaidMinor = order.totalMinorUnits - order.platformCreditsApplied - order.storeCreditsApplied;
    const fees = newStatus === 'confirmed'
      ? await this.loyalty.computeOrderFees(order.sellerId, order.totalMinorUnits, netPaidMinor)
      : null;

    await this.prisma.marketplaceOrder.update({
      where: { id: order.id },
      data: {
        status: newStatus,
        paymentId,
        ...(fees && {
          commissionMinorUnits: fees.commissionMinor,
          platformCashbackMinor: fees.platformCashbackMinor,
          storeCashbackMinor: fees.storeCashbackMinor,
        }),
        events: { create: { type: eventType, payload: eventPayload as object } },
      },
    });

    if (newStatus === 'confirmed' && order.customerId && fees) {
      await this.loyalty.awardCashback({
        customerId: order.customerId,
        sellerId: order.sellerId,
        orderId: order.id,
        platformCashbackMinor: fees.platformCashbackMinor,
        storeCashbackMinor: fees.storeCashbackMinor,
      });
    }

    if (newStatus === 'cancelled' && order.customerId
        && (order.platformCreditsApplied > 0 || order.storeCreditsApplied > 0)) {
      await this.loyalty.refundCredits({
        customerId: order.customerId,
        sellerId: order.sellerId,
        orderId: order.id,
        platformCreditsApplied: order.platformCreditsApplied,
        storeCreditsApplied: order.storeCreditsApplied,
      });
    }

    return true;
  }

  /** Force-reconcile a still-pending order against the MP Payments Search API. */
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
    if (!newStatus) return { status: order.status, updated: false };

    const applied = await this.finalizeOrderStatus(
      order, newStatus, String(latest.id), `reconciled_${latest.status}`,
      { paymentId: latest.id, mpStatus: latest.status, amount: latest.transaction_amount },
    );
    return { status: applied ? newStatus : order.status, updated: applied };
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

    await this.finalizeOrderStatus(
      order, newStatus, paymentId, `payment_${payment.status}`,
      { paymentId, mpStatus: payment.status, amount: payment.transaction_amount },
    );
    return { processed: true };
  }

  async listCustomerOrders(customerId: string, limit = 20) {
    return this.prisma.marketplaceOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        seller: { select: { name: true, slug: true } },
        lines: {
          include: {
            listing: {
              include: { product: { select: { name: true, slug: true, images: true } } },
            },
          },
        },
      },
    });
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

  /**
   * Manual payout tracking — stopgap while a seller hasn't connected their own MP
   * account for the real-time 1:1 split (the platform collects 100% via its own
   * account in that case). Admin marks here once the seller's net payout has
   * actually been transferred outside the platform.
   */
  async markPaidOut(orderId: string, paidOutBy: string) {
    const order = await this.prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== 'confirmed' && order.status !== 'delivered' && order.status !== 'shipped') {
      throw new BadRequestException(`Cannot mark a "${order.status}" order as paid out — payment isn't confirmed yet`);
    }
    return this.prisma.marketplaceOrder.update({
      where: { id: orderId },
      data: { paidOutAt: new Date(), paidOutBy },
    });
  }

  async unmarkPaidOut(orderId: string) {
    return this.prisma.marketplaceOrder.update({
      where: { id: orderId },
      data: { paidOutAt: null, paidOutBy: null },
    });
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

  async assertCustomerOwnsOrder(orderId: string, customerId: string): Promise<void> {
    const order = await this.prisma.marketplaceOrder.findFirst({
      where: { id: orderId, customerId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');
  }

  async getCustomerOrder(orderId: string, customerId: string) {
    await this.assertCustomerOwnsOrder(orderId, customerId);
    return this.getOrder(orderId);
  }

  // ── MercadoPago helpers ────────────────────────────────────────────────────

  private get mpToken() {
    return process.env.MERCADOPAGO_ACCESS_TOKEN ?? '';
  }

  private async createMpPreference(params: {
    orderId: string;
    sellerMpToken: string | null;
    marketplaceFee?: number;
    items: Array<{
      id: string; title: string; quantity: number;
      unit_price: number; currency_id: string; picture_url: string;
    }>;
    payer: { email: string; name: string };
    successUrl: string;
    failureUrl: string;
    pendingUrl: string;
  }): Promise<{ id: string; init_point: string; sandbox_init_point?: string }> {
    // Use seller's token for marketplace split, fall back to platform token for dev
    const token = params.sellerMpToken ?? this.mpToken;

    if (!token) {
      return {
        id: `dev-pref-${params.orderId}`,
        init_point: `${params.successUrl}?order_id=${params.orderId}&dev_mode=1`,
      };
    }

    const body: Record<string, unknown> = {
      external_reference: params.orderId,
      items: params.items,
      payer: params.payer,
      back_urls: {
        success: params.successUrl,
        failure: params.failureUrl,
        pending: params.pendingUrl,
      },
      notification_url: `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/v1/checkout/webhooks/mercadopago`,
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    // MP rejects auto_return unless back_urls.success is a publicly reachable
    // https URL — only request it when that's true (production / tunneled dev).
    // Locally over http, the buyer just clicks "volver al sitio" manually instead.
    if (params.successUrl.startsWith('https://')) {
      body['auto_return'] = 'approved';
    }

    // Marketplace split: MP routes the fee to the platform (the app that issued the
    // seller's OAuth token) automatically. Per MP docs only `marketplace_fee` is sent;
    // adding a `marketplace` field (numeric client_id) breaks payment processing.
    if (params.sellerMpToken && params.marketplaceFee) {
      body['marketplace_fee'] = params.marketplaceFee;
    }

    const res = await fetch(`${MP_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new BadRequestException(`MercadoPago preference error: ${err}`);
    }

    return res.json() as Promise<{ id: string; init_point: string; sandbox_init_point?: string }>;
  }

  /**
   * Refund an order's payment through MercadoPago and settle every balance it
   * moved. This is what the seller portal's "cancel a paid order" needs: a
   * status flip alone would leave the buyer charged for something they will
   * never receive.
   *
   * The refund must be issued against the account that COLLECTED the money. A
   * connected seller's payment was taken with their own OAuth token (that is
   * what makes MP split it); refunding it with the platform token would 404,
   * because the payment does not exist under the platform's account. Falls
   * back to the platform token only for sellers who never connected, which is
   * exactly the case where the platform did collect.
   *
   * Three balances settle here, and all three matter:
   *  - the gateway payment goes back to the buyer (MP);
   *  - wallet credits they spent on the order are returned (refundCredits);
   *  - cashback the order earned is reversed (clawbackCashback) — otherwise a
   *    buy-then-refund loop mints credits out of nothing.
   */
  async refundOrder(orderId: string, reason?: string): Promise<{
    status: string;
    refundId: string | null;
    amountMinor: number;
  }> {
    const order = await this.prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: orderId } });

    if (order.status === 'refunded') {
      return { status: 'refunded', refundId: null, amountMinor: 0 };
    }
    if (!order.paymentId) {
      throw new BadRequestException('This order has no captured payment to refund');
    }

    let token: string | null = null;
    try {
      token = await this.mpOAuth.getSellerAccessToken(order.sellerId);
    } catch {
      token = this.mpToken || null;
    }
    if (!token) {
      throw new BadRequestException('No MercadoPago credentials available to issue this refund');
    }

    const res = await fetch(`${MP_BASE}/v1/payments/${order.paymentId}/refunds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      // No body = full refund of the captured amount, which is what a cancelled
      // order always is. Partial refunds would need their own reconciliation of
      // commission and cashback and are deliberately not exposed here.
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new BadRequestException(`MercadoPago refund failed: ${detail}`);
    }

    const refund = (await res.json()) as { id?: number; amount?: number };

    // Return the credits the buyer spent, then take back what the purchase earned.
    if (order.customerId && (order.platformCreditsApplied > 0 || order.storeCreditsApplied > 0)) {
      await this.loyalty.refundCredits({
        customerId: order.customerId,
        sellerId: order.sellerId,
        orderId: order.id,
        platformCreditsApplied: order.platformCreditsApplied,
        storeCreditsApplied: order.storeCreditsApplied,
      });
    }
    let clawback = { platformClawedBackMinor: 0, storeClawedBackMinor: 0 };
    if (order.customerId && (order.platformCashbackMinor > 0 || order.storeCashbackMinor > 0)) {
      clawback = await this.loyalty.clawbackCashback({
        customerId: order.customerId,
        sellerId: order.sellerId,
        orderId: order.id,
        platformCashbackMinor: order.platformCashbackMinor,
        storeCashbackMinor: order.storeCashbackMinor,
      });
    }

    await this.prisma.marketplaceOrder.update({
      where: { id: order.id },
      data: {
        status: 'refunded',
        events: {
          create: {
            type: 'refunded',
            payload: {
              refundId: refund.id ?? null,
              paymentId: order.paymentId,
              amountMinor: order.totalMinorUnits,
              ...(reason ? { reason } : {}),
              // Recorded because it can be less than what was awarded when the
              // buyer already spent some of it — the gap is a real write-off.
              cashbackClawedBack: clawback,
            },
          },
        },
      },
    });

    return { status: 'refunded', refundId: refund.id ? String(refund.id) : null, amountMinor: order.totalMinorUnits };
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
