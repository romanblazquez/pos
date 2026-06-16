import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import type { CreateSellerDto } from './sellers.dto.js';

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  async getListings(sellerId: string, params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    sort?: string;
  }) {
    const where: Record<string, unknown> = { sellerId };

    if (params.q) {
      where['product'] = { name: { contains: params.q, mode: 'insensitive' } };
    }
    if (params.status === 'active')       where['active'] = true;
    if (params.status === 'inactive')     where['active'] = false;
    if (params.status === 'out_of_stock') where['stockStatus'] = 'out_of_stock';
    if (params.status === 'low_stock')    where['stockStatus'] = 'low_stock';

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
        },
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: (params.page - 1) * params.limit,
      }),
      this.prisma.marketplaceOrder.count({ where }),
    ]);

    return { orders, total, page: params.page, limit: params.limit };
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

  async list(params: { status?: string; limit?: number; offset?: number }) {
    const { status, limit = 50, offset = 0 } = params;
    return this.prisma.seller.findMany({
      where: status ? { status } : {},
      include: { score: true },
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
