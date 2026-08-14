import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { ProductIndexerService } from '../search/product-indexer.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import type { CreateSellerDto, UpdateOrderStatusDto } from './sellers.dto.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class SellersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductIndexerService) private readonly indexer: ProductIndexerService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService,
  ) {}

  /**
   * Change a seller's lifecycle status and make it take effect immediately.
   *
   * Flipping the column is not enough: product cards are served from the search
   * index, whose price aggregates were built from this seller's listings. Without
   * reindexing, a banned seller's prices keep appearing on every card until the
   * next scheduled pass. Reindex synchronously so "suspend" means suspended now.
   */
  async setStatus(id: string, status: 'active' | 'suspended', actorId?: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });
    if (!seller) throw new NotFoundException(`Seller "${id}" not found`);

    const updated = await this.prisma.seller.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, slug: true, status: true, updatedAt: true },
    });

    await this.reindexSellerProducts(id);

    await this.prisma.auditEvent.create({
      data: {
        targetType: 'seller',
        targetId: id,
        // A seller leaving `pending` for the first time is an approval, not a
        // reactivation. They read the same in the column and mean opposite
        // things in an audit log — one is "we vetted them", the other is "we
        // reversed a ban".
        action: status === 'suspended'
          ? 'seller.suspended'
          : seller.status === 'pending' ? 'seller.approved' : 'seller.reactivated',
        actorPrincipalId: actorId ?? null,
        metadata: { from: seller.status, to: status, sellerName: seller.name },
      },
    }).catch(() => undefined);

    return updated;
  }

  /**
   * Permanently delete a seller.
   *
   * Refuses while the seller has orders: an order is a financial record and a
   * customer's purchase history, and deleting one to tidy up a seller list would
   * destroy both. Suspension is the reversible tool; deletion is for sellers who
   * never traded.
   */
  async deleteSeller(id: string, actorId?: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { orders: true, listings: true } } },
    });
    if (!seller) throw new NotFoundException(`Seller "${id}" not found`);

    if (seller._count.orders > 0) {
      throw new ConflictException(
        `Seller "${seller.name}" has ${seller._count.orders} order(s) and cannot be deleted. ` +
        'Suspend the seller instead — deleting would destroy financial records and customer purchase history.',
      );
    }

    const productIds = await this.sellerProductIds(id);
    await this.prisma.seller.delete({ where: { id } });

    // Reindex AFTER deletion so the aggregates no longer see those listings.
    for (const productId of productIds) await this.indexer.syncProductQuietly(productId);

    await this.prisma.auditEvent.create({
      data: {
        targetType: 'seller',
        targetId: id,
        action: 'seller.deleted',
        actorPrincipalId: actorId ?? null,
        metadata: { name: seller.name, listings: seller._count.listings },
      },
    }).catch(() => undefined);

    return { id, deleted: true };
  }

  private async sellerProductIds(sellerId: string): Promise<string[]> {
    const rows = await this.prisma.listing.findMany({
      where: { sellerId },
      select: { productId: true },
      distinct: ['productId'],
    });
    return rows.map((row) => row.productId);
  }

  private async reindexSellerProducts(sellerId: string) {
    for (const productId of await this.sellerProductIds(sellerId)) {
      await this.indexer.syncProductQuietly(productId);
    }
  }

  async create(dto: CreateSellerDto) {
    const existing = await this.prisma.seller.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    let slug = slugify(dto.name);
    // Ensure uniqueness
    const conflict = await this.prisma.seller.findUnique({ where: { slug } });
    if (conflict) slug = `${slug}-${Date.now()}`;

    return this.prisma.seller.create({
      data: {
        name: dto.name,
        slug,
        email: dto.email,
        phone: dto.phone,
        country: dto.country ?? 'MX',
        timezone: dto.timezone ?? 'America/Mexico_City',
        connectorType: dto.connectorType,
        status: 'pending',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.seller.findUnique({
      where: { id },
      include: { score: true, syncLogs: { take: 10, orderBy: { startedAt: 'desc' } } },
    });
  }

  async getSyncHealth(sellerId: string) {
    const logs = await this.prisma.connectorSyncLog.findMany({
      where: { sellerId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const byType = ['catalog', 'inventory', 'prices'].map((type) => {
      const latest = logs.find((l) => l.syncType === type);
      return {
        type,
        status: latest?.status ?? 'never',
        lastRun: latest?.startedAt ?? null,
        itemsSynced: latest?.itemsSynced ?? 0,
        itemsFailed: latest?.itemsFailed ?? 0,
        errors: latest?.errors ?? null,
      };
    });

    return { sellerId, syncs: byType };
  }

  async setConnectorType(sellerId: string, connectorType: string) {
    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { connectorType },
      select: { id: true, connectorType: true },
    });
  }

  async getListingStats(sellerId: string) {
    const [total, active, outOfStock, lowStock] = await Promise.all([
      this.prisma.listing.count({ where: { sellerId } }),
      this.prisma.listing.count({ where: { sellerId, active: true } }),
      this.prisma.listing.count({ where: { sellerId, stockStatus: 'out_of_stock' } }),
      this.prisma.listing.count({ where: { sellerId, stockStatus: 'low_stock' } }),
    ]);
    return { total, active, outOfStock, lowStock };
  }

  private buildListingWhere(sellerId: string, filter: { q?: string; status?: string }) {
    const where: Record<string, unknown> = { sellerId };

    if (filter.q) {
      where['product'] = { name: { contains: filter.q, mode: 'insensitive' } };
    }
    if (filter.status === 'active')       where['active'] = true;
    if (filter.status === 'inactive')     where['active'] = false;
    if (filter.status === 'out_of_stock') where['stockStatus'] = 'out_of_stock';
    if (filter.status === 'low_stock')    where['stockStatus'] = 'low_stock';

    return where;
  }

  async getListings(sellerId: string, params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    sort?: string;
  }) {
    const where = this.buildListingWhere(sellerId, params);

    const orderBy: Record<string, string> =
      params.sort === 'price_asc'  ? { priceMinorUnits: 'asc' } :
      params.sort === 'price_desc' ? { priceMinorUnits: 'desc' } :
      params.sort === 'stock_asc'  ? { stock: 'asc' } :
      params.sort === 'stock_desc' ? { stock: 'desc' } :
      params.sort === 'name'       ? {} :
      { lastSyncedAt: 'desc' };

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: {
          product: {
            select: {
              id: true, name: true, images: true, description: true,
              category: true, slug: true, tags: true,
            },
          },
        },
        take: params.limit,
        skip: (params.page - 1) * params.limit,
        orderBy: Object.keys(orderBy).length ? orderBy : { lastSyncedAt: 'desc' },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { listings, total, page: params.page, limit: params.limit };
  }

  async updateListing(sellerId: string, listingId: string, data: {
    priceMinorUnits?: number;
    stock?: number;
    active?: boolean;
  }) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, sellerId },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    const patch: Record<string, unknown> = {};
    if (data.priceMinorUnits !== undefined) patch['priceMinorUnits'] = data.priceMinorUnits;
    if (data.active !== undefined) patch['active'] = data.active;
    if (data.stock !== undefined) {
      patch['stock'] = data.stock;
      patch['stockStatus'] = data.stock === 0 ? 'out_of_stock' : data.stock <= 3 ? 'low_stock' : 'in_stock';
    }

    return this.prisma.listing.update({ where: { id: listingId }, data: patch });
  }

  async bulkUpdateListings(sellerId: string, selection: {
    ids?: string[];
    filter?: { q?: string; status?: string };
  }, data: { active: boolean }) {
    const where = selection.ids?.length
      ? { id: { in: selection.ids }, sellerId }
      : this.buildListingWhere(sellerId, selection.filter ?? {});

    const { count } = await this.prisma.listing.updateMany({ where, data: { active: data.active } });
    return { updated: count };
  }

  async getOrderStats(sellerId: string) {
    const [total, pending, confirmed, shipped, cancelled, revenue] = await Promise.all([
      this.prisma.marketplaceOrder.count({ where: { sellerId } }),
      this.prisma.marketplaceOrder.count({ where: { sellerId, status: 'pending' } }),
      this.prisma.marketplaceOrder.count({ where: { sellerId, status: 'confirmed' } }),
      this.prisma.marketplaceOrder.count({ where: { sellerId, status: 'shipped' } }),
      this.prisma.marketplaceOrder.count({ where: { sellerId, status: 'cancelled' } }),
      this.prisma.marketplaceOrder.aggregate({
        where: { sellerId, status: { notIn: ['cancelled', 'refunded'] } },
        _sum: { totalMinorUnits: true },
      }),
    ]);

    // Last 7 days daily breakdown
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentOrders = await this.prisma.marketplaceOrder.findMany({
      where: { sellerId, createdAt: { gte: since }, status: { notIn: ['cancelled', 'refunded'] } },
      select: { createdAt: true, totalMinorUnits: true },
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate into daily buckets
    const dailyMap = new Map<string, { orders: number; revenueMinor: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dailyMap.set(d.toISOString().slice(0, 10), { orders: 0, revenueMinor: 0 });
    }
    for (const o of recentOrders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.orders++;
        bucket.revenueMinor += o.totalMinorUnits;
      }
    }

    return {
      total,
      pending,
      confirmed,
      shipped,
      cancelled,
      revenueMinorUnits: revenue._sum.totalMinorUnits ?? 0,
      daily: Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v })),
    };
  }

  async getOrders(sellerId: string, params: { page: number; limit: number; status?: string }) {
    const where: Record<string, unknown> = { sellerId };
    if (params.status && params.status !== 'all') where['status'] = params.status;

    const [orders, total] = await Promise.all([
      this.prisma.marketplaceOrder.findMany({
        where,
        include: {
          lines: {
            include: {
              listing: {
                include: {
                  product: { select: { name: true, images: true, slug: true } },
                },
              },
            },
          },
          // Newest first, capped — this is for surfacing the latest tracking
          // number / cancellation reason next to the order, not a full audit
          // trail in the portal UI.
          events: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: (params.page - 1) * params.limit,
      }),
      this.prisma.marketplaceOrder.count({ where }),
    ]);

    return { orders, total, page: params.page, limit: params.limit };
  }

  /**
   * Seller-initiated order status transition (fulfillment). Only the moves a
   * seller can make honestly without a payment integration are allowed:
   * confirm shipment, confirm delivery, or cancel a not-yet-paid order.
   *
   * Cancelling an order already paid through a real payment provider needs an
   * actual refund through that provider, not just a status flip — that
   * integration doesn't exist yet, so it's blocked here with a clear reason
   * rather than silently leaving a buyer paid for a cancelled order.
   * Wallet-credits-only orders ARE refundable today (loyalty.refundCredits),
   * so those go through.
   */
  async updateOrderStatus(sellerId: string, orderId: string, input: UpdateOrderStatusDto) {
    const order = await this.prisma.marketplaceOrder.findFirst({ where: { id: orderId, sellerId } });
    if (!order) throw new NotFoundException(`Order "${orderId}" not found for this seller`);

    const allowedFrom: Record<string, string[]> = {
      confirmed: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      pending: ['cancelled'],
      reserved: ['cancelled'],
    };
    if (!(allowedFrom[order.status] ?? []).includes(input.status)) {
      throw new ConflictException(`Cannot move an order from "${order.status}" to "${input.status}"`);
    }

    if (input.status === 'cancelled') {
      if (order.status === 'confirmed' && order.paymentProvider && order.paymentProvider !== 'wallet_credits') {
        throw new ConflictException(
          'This order was paid through a real payment provider and cannot be cancelled here — it needs an actual refund, not just a status change. Refunding is not yet supported from the seller portal.',
        );
      }
      if (order.customerId && (order.platformCreditsApplied > 0 || order.storeCreditsApplied > 0)) {
        await this.loyalty.refundCredits({
          customerId: order.customerId,
          sellerId,
          orderId: order.id,
          platformCreditsApplied: order.platformCreditsApplied,
          storeCreditsApplied: order.storeCreditsApplied,
        });
      }
    }

    const eventType = input.status === 'cancelled' ? 'cancelled_by_seller' : input.status;
    const payload: Record<string, unknown> = {};
    if (input.trackingCarrier) payload.trackingCarrier = input.trackingCarrier;
    if (input.trackingNumber) payload.trackingNumber = input.trackingNumber;
    if (input.reason) payload.reason = input.reason;

    return this.prisma.marketplaceOrder.update({
      where: { id: orderId },
      data: {
        status: input.status,
        events: { create: { type: eventType, payload: payload as object } },
      },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
  }

  async getTopProducts(sellerId: string, limit = 5) {
    const lines = await this.prisma.marketplaceOrderLine.findMany({
      where: { order: { sellerId, status: { notIn: ['cancelled', 'refunded'] } } },
      include: {
        listing: {
          include: { product: { select: { name: true, images: true } } },
        },
      },
    });

    const byProduct = new Map<string, { name: string; image: string | null; units: number; revenueMinor: number }>();
    for (const line of lines) {
      const name = line.listing.product.name;
      const image = line.listing.product.images[0] ?? null;
      const key = line.listing.productId;
      const existing = byProduct.get(key) ?? { name, image, units: 0, revenueMinor: 0 };
      existing.units += line.quantity;
      existing.revenueMinor += line.lineTotalMinor;
      byProduct.set(key, existing);
    }

    return Array.from(byProduct.values())
      .sort((a, b) => b.revenueMinor - a.revenueMinor)
      .slice(0, limit);
  }

  /**
   * Sellers for the admin console.
   *
   * Explicitly selected, not `include: { score }` over the whole row. The row
   * carries `passwordHash`, `verifyToken` and `connectorConfig`, and all three
   * were being serialized to the admin client on every page load. `verifyToken`
   * is a single-use account-verification secret — handing it out is an account
   * takeover waiting for one logged response or one shared browser.
   *
   * `onboardingData` IS included: it is what an admin reviews before approving,
   * and there is no queue without it.
   */
  async list(params: { status?: string; limit?: number; offset?: number }) {
    const { status, limit = 50, offset = 0 } = params;
    return this.prisma.seller.findMany({
      where: status ? { status } : {},
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        country: true,
        status: true,
        tier: true,
        connectorType: true,
        commissionRate: true,
        onboardingStep: true,
        onboardingData: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        score: true,
        _count: { select: { listings: true, orders: true } },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProfile(id: string, data: { name?: string; phone?: string; timezone?: string }) {
    const seller = await this.prisma.seller.findUnique({ where: { id } });
    if (!seller) throw new NotFoundException(`Seller "${id}" not found`);
    return this.prisma.seller.update({ where: { id }, data });
  }

  // ── Per-listing promos ───────────────────────────────────────────────────────

  async getListingPromos(sellerId: string, listingId: string) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, sellerId } });
    if (!listing) throw new NotFoundException('Listing not found');
    return this.prisma.listingPromo.findMany({
      where: { listingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createListingPromo(
    sellerId: string,
    listingId: string,
    data: { bonusCashbackPct: number; label?: string; startsAt?: string; endsAt?: string },
  ) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, sellerId } });
    if (!listing) throw new NotFoundException('Listing not found');
    return this.prisma.listingPromo.create({
      data: {
        listingId,
        bonusCashbackPct: data.bonusCashbackPct,
        label: data.label ?? null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        active: true,
      },
    });
  }

  async updateListingPromo(
    sellerId: string,
    listingId: string,
    promoId: string,
    data: { bonusCashbackPct?: number; label?: string; startsAt?: string | null; endsAt?: string | null; active?: boolean },
  ) {
    const promo = await this.prisma.listingPromo.findFirst({
      where: { id: promoId, listingId, listing: { sellerId } },
    });
    if (!promo) throw new NotFoundException('Promo not found');
    return this.prisma.listingPromo.update({
      where: { id: promoId },
      data: {
        ...(data.bonusCashbackPct !== undefined && { bonusCashbackPct: data.bonusCashbackPct }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.startsAt !== undefined && { startsAt: data.startsAt ? new Date(data.startsAt) : null }),
        ...(data.endsAt !== undefined && { endsAt: data.endsAt ? new Date(data.endsAt) : null }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
  }

  async deleteListingPromo(sellerId: string, listingId: string, promoId: string) {
    const promo = await this.prisma.listingPromo.findFirst({
      where: { id: promoId, listingId, listing: { sellerId } },
    });
    if (!promo) throw new NotFoundException('Promo not found');
    await this.prisma.listingPromo.delete({ where: { id: promoId } });
  }

  async aiEnhanceListing(
    sellerId: string,
    listingId: string,
    ai: import('../ai/ai.service.js').AiService,
    aiUsage: import('../ai/ai-usage.service.js').AiUsageService,
  ) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, sellerId },
      include: { product: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    // Throws ForbiddenException on starter tier or an exhausted monthly budget.
    const usage = await aiUsage.assertCanEnhance(sellerId);

    const allSkus = await this.prisma.listing
      .findMany({ where: { sellerId }, select: { sellerSku: true } })
      .then((rows) => rows.map((r) => r.sellerSku).filter(Boolean) as string[]);

    const result = await ai.enhanceProduct({
      name: listing.product.name,
      description: listing.product.description,
      tags: listing.product.tags,
      publisher: listing.product.publisher,
      designer: listing.product.designer,
      category: listing.product.category,
      yearPublished: listing.product.yearPublished,
      minPlayers: listing.product.minPlayers,
      maxPlayers: listing.product.maxPlayers,
      playTimeMinutes: listing.product.playTimeMinutes,
      language: listing.product.language,
      sellerSku: listing.sellerSku,
      allSellerSkus: allSkus,
    });

    await aiUsage.recordEnhancement(sellerId, listing.productId, 'gpt-4o-mini', result);

    return { listingId, productId: listing.productId, current: {
      name: listing.product.name,
      description: listing.product.description,
      slug: listing.product.slug,
      tags: listing.product.tags,
      sellerSku: listing.sellerSku,
    }, suggested: result, usage: {
      tier: usage.tier,
      used: usage.used + 1,
      limit: usage.limit,
      remaining: usage.limit === null ? null : Math.max(0, usage.limit - usage.used - 1),
      unlimited: usage.unlimited,
    } };
  }

  async applyProductPatch(sellerId: string, listingId: string, data: {
    name?: string; description?: string; slug?: string; tags?: string[]; sellerSku?: string;
  }) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, sellerId },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    const productPatch: Record<string, unknown> = {};
    if (data.name !== undefined) productPatch['name'] = data.name;
    if (data.description !== undefined) productPatch['description'] = data.description;
    if (data.tags !== undefined) productPatch['tags'] = data.tags;
    if (data.slug !== undefined) {
      const existing = await this.prisma.mktProduct.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== listing.productId) {
        productPatch['slug'] = `${data.slug}-${listingId.slice(-6)}`;
      } else {
        productPatch['slug'] = data.slug;
      }
    }

    if (Object.keys(productPatch).length > 0) {
      await this.prisma.mktProduct.update({ where: { id: listing.productId }, data: productPatch });
    }

    if (data.sellerSku !== undefined) {
      await this.prisma.listing.update({ where: { id: listingId }, data: { sellerSku: data.sellerSku } });
    }

    return this.prisma.listing.findUnique({ where: { id: listingId }, include: { product: true } });
  }

  /** Returns the active promo (if any) for a listing at the current moment. */
  async getActivePromo(listingId: string) {
    const now = new Date();
    return this.prisma.listingPromo.findFirst({
      where: {
        listingId,
        active: true,
        OR: [
          { startsAt: null, endsAt: null },
          { startsAt: { lte: now }, endsAt: null },
          { startsAt: null, endsAt: { gte: now } },
          { startsAt: { lte: now }, endsAt: { gte: now } },
        ],
      },
      orderBy: { bonusCashbackPct: 'desc' },
    });
  }
}
