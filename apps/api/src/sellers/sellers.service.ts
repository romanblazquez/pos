import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';

export interface CreateSellerDto {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  timezone?: string;
  connectorType?: string;
}

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
}
