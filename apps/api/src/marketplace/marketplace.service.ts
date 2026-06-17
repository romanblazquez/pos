import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { TypesenseService } from '../search/typesense.service.js';

export interface ProductSearchParams {
  q?: string;
  category?: string;
  minPlayers?: number;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
}

@Injectable()
export class MarketplaceService {
  constructor(
    @Inject(PrismaService)    private readonly prisma: PrismaService,
    @Inject(TypesenseService) private readonly search: TypesenseService,
  ) {}

  async searchProducts(params: ProductSearchParams) {
    const { q = '', limit = 24, offset = 0 } = params;

    // Typesense path — fast, ranked
    const { hits, total } = await this.search.search({
      q,
      category: params.category,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minPlayers: params.minPlayers,
      inStockOnly: params.inStockOnly,
      limit,
      offset,
    });

    if (hits.length > 0) {
      return { results: hits, total, source: 'search' as const };
    }

    // Prisma fallback — when Typesense is empty or unavailable
    const where = {
      canonicalStatus: 'verified' as const,
      ...(params.category ? { category: params.category } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { publisher: { contains: q, mode: 'insensitive' as const } },
          { tags: { has: q } },
        ],
      } : {}),
    };

    const [products, totalCount] = await Promise.all([
      this.prisma.mktProduct.findMany({
        where,
        include: {
          listings: {
            where: { active: true },
            select: { priceMinorUnits: true, currency: true, stockStatus: true },
          },
        },
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' },
      }),
      this.prisma.mktProduct.count({ where }),
    ]);

    const results = products.map((p) => {
      const active = p.listings.filter((l) => l.stockStatus !== 'out_of_stock');
      const prices = p.listings.map((l) => l.priceMinorUnits);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        images: p.images,
        publisher: p.publisher,
        minPlayers: p.minPlayers,
        maxPlayers: p.maxPlayers,
        bggRating: p.bggRating,
        minPriceMinor: prices.length ? Math.min(...prices) : 0,
        maxPriceMinor: prices.length ? Math.max(...prices) : 0,
        currency: p.listings[0]?.currency ?? 'MXN',
        totalListings: p.listings.length,
        inStockListings: active.length,
      };
    });

    return { results, total: totalCount, source: 'db' as const };
  }

  async getProduct(slug: string) {
    const product = await this.prisma.mktProduct.findUnique({
      where: { slug },
      include: {
        listings: {
          where: { active: true },
          include: {
            deliveryOptions: true,
            seller: { include: { score: true, rewardConfig: true } },
            promos: {
              where: {
                active: true,
                OR: [
                  { startsAt: null, endsAt: null },
                  { startsAt: { lte: new Date() }, endsAt: null },
                  { startsAt: null, endsAt: { gte: new Date() } },
                  { startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
                ],
              },
              orderBy: { bonusCashbackPct: 'desc' },
              take: 1,
            },
          },
          orderBy: { rankScore: 'desc' },
        },
      },
    });

    if (!product) return null;

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      images: product.images,
      publisher: product.publisher,
      designer: product.designer,
      yearPublished: product.yearPublished,
      minPlayers: product.minPlayers,
      maxPlayers: product.maxPlayers,
      minAge: product.minAge,
      playTimeMinutes: product.playTimeMinutes,
      language: product.language,
      bggId: product.bggId,
      bggRating: product.bggRating,
      bggWeight: product.bggWeight,
      tags: product.tags,
      listings: product.listings.map((l) => ({
        id: l.id,
        sellerId: l.sellerId,
        sellerName: l.seller.name,
        sellerSlug: l.seller.slug,
        sellerScore: l.seller.score?.compositeScore ?? 0.5,
        priceMinorUnits: l.priceMinorUnits,
        currency: l.currency,
        stock: l.stock,
        stockStatus: l.stockStatus,
        stockConfidence: l.stockConfidence,
        rankScore: l.rankScore,
        scoreBreakdown: l.scoreBreakdown ?? {
          availability: 0, priceCompetitiveness: 0, delivery: 0,
          sellerReliability: 0, sellerQuality: 0, integrationHealth: 0,
        },
        deliveryOptions: l.deliveryOptions.map((d) => ({
          id: d.id,
          name: d.name,
          estimatedDaysMin: d.estimatedDaysMin,
          estimatedDaysMax: d.estimatedDaysMax,
          priceMinorUnits: d.priceMinorUnits,
          type: d.type,
        })),
        lastSyncedAt: l.lastSyncedAt,
        storeCashbackPct: l.seller.rewardConfig?.storeCashbackPct ?? 0,
        promoBonus: l.promos[0]?.bonusCashbackPct ?? 0,
        promoLabel: l.promos[0]?.label ?? null,
      })),
    };
  }
}
