import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { TypesenseService } from '../search/typesense.service.js';
import { DEFAULT_CURRENCY_CODE } from '../markets/default-market.constants.js';

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

// entityType tag used on EntityLocalization rows for MktProduct — the schema
// is polymorphic (entityType/entityId), so wiring localization onto a model
// never needs a migration, just a consistent literal for that model.
const PRODUCT_ENTITY_TYPE = 'mkt_product';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @Inject(PrismaService)    private readonly prisma: PrismaService,
    @Inject(TypesenseService) private readonly search: TypesenseService,
  ) {}

  /**
   * Approved title/description overrides for the given product ids, keyed by
   * entityId. Returns an empty map for the default locale, or if the
   * Language/EntityLocalization tables aren't migrated/seeded yet in this
   * environment — callers fall back to the base Spanish fields either way.
   */
  private async getProductLocalizations(
    productIds: string[],
    locale?: string,
  ): Promise<Map<string, { title: string; description: string | null }>> {
    if (locale !== 'en' || productIds.length === 0) return new Map();
    try {
      // Language.code is the full locale tag (e.g. 'en-US'); iso6391 is the
      // canonical 2-letter lookup for the primary regional variant.
      const language = await this.prisma.language.findFirst({ where: { iso6391: 'en' } });
      if (!language) return new Map();
      const rows = await this.prisma.entityLocalization.findMany({
        where: {
          entityType: PRODUCT_ENTITY_TYPE,
          entityId: { in: productIds },
          languageId: language.id,
          moderationStatus: 'APPROVED',
        },
      });
      return new Map(rows.map((row) => [row.entityId, { title: row.title, description: row.description }]));
    } catch (err) {
      this.logger.warn(`Skipping product localization (table likely unmigrated): ${String(err)}`);
      return new Map();
    }
  }

  async searchProducts(params: ProductSearchParams, locale?: string) {
    const { q = '', limit = 24, offset = 0 } = params;

    // Typesense path — fast, ranked
    const { hits, total } = await this.search.search({
      q,
      category: params.category,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minPlayers: params.minPlayers,
      inStockOnly: params.inStockOnly,
      sortBy: normalizeSort(params.sortBy),
      limit,
      offset,
    });

    if (hits.length > 0) {
      return { results: hits, total, source: 'search' as const };
    }

    // Prisma fallback — when Typesense is empty or unavailable
    const listingFilter = {
      active: true,
      ...(params.inStockOnly ? { stockStatus: { not: 'out_of_stock' } } : {}),
      ...((params.minPrice !== undefined || params.maxPrice !== undefined) ? {
        priceMinorUnits: {
          ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
          ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
        },
      } : {}),
    };

    const where = {
      canonicalStatus: 'verified' as const,
      ...(params.category ? { category: params.category } : {}),
      ...(params.minPlayers ? {
        minPlayers: { lte: params.minPlayers },
        maxPlayers: { gte: params.minPlayers },
      } : {}),
      listings: { some: listingFilter },
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { publisher: { contains: q, mode: 'insensitive' as const } },
          { designer: { contains: q, mode: 'insensitive' as const } },
          { description: { contains: q, mode: 'insensitive' as const } },
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

    // Only the Prisma fallback path is localized today — the Typesense hit
    // path above returns pre-indexed search documents, which would need a
    // per-locale reindex to localize (future work, see the markets roadmap's
    // search-projection phase). Fine for now: this fallback only runs when
    // Typesense is empty/unavailable.
    const localizations = await this.getProductLocalizations(products.map((p) => p.id), locale);

    const results = products.map((p) => {
      const active = p.listings.filter((l) => l.stockStatus !== 'out_of_stock');
      const prices = p.listings.map((l) => l.priceMinorUnits);
      const localized = localizations.get(p.id);
      return {
        id: p.id,
        slug: p.slug,
        name: localized?.title ?? p.name,
        images: p.images,
        category: p.category,
        tags: p.tags,
        description: localized?.description ?? p.description,
        publisher: p.publisher,
        minPlayers: p.minPlayers,
        maxPlayers: p.maxPlayers,
        minAge: p.minAge,
        playTimeMinutes: p.playTimeMinutes,
        bggRating: p.bggRating,
        minPriceMinor: prices.length ? Math.min(...prices) : 0,
        maxPriceMinor: prices.length ? Math.max(...prices) : 0,
        currency: p.listings[0]?.currency ?? DEFAULT_CURRENCY_CODE,
        totalListings: p.listings.length,
        inStockListings: active.length,
      };
    });

    return { results, total: totalCount, source: 'db' as const };
  }

  async getSuggestions(q = '', requestedLimit = 8) {
    const query = q.trim().slice(0, 80);
    const limit = Math.min(10, Math.max(1, requestedLimit));
    const directProducts = await this.prisma.mktProduct.findMany({
      where: {
        canonicalStatus: 'verified',
        ...(query ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { publisher: { contains: query, mode: 'insensitive' as const } },
            { designer: { contains: query, mode: 'insensitive' as const } },
            { tags: { has: query } },
          ],
        } : { listings: { some: { active: true } } }),
      },
      include: {
        listings: {
          where: { active: true },
          select: { stockStatus: true },
        },
      },
      orderBy: query ? { name: 'asc' } : [{ bggRank: 'asc' }, { name: 'asc' }],
      take: query ? 30 : limit,
    });

    const normalizedQuery = query.toLocaleLowerCase();
    const suggestionProducts = directProducts
      .sort((left, right) => {
        const leftName = left.name.toLocaleLowerCase();
        const rightName = right.name.toLocaleLowerCase();
        const leftScore = leftName === normalizedQuery ? 0 : leftName.startsWith(normalizedQuery) ? 1 : 2;
        const rightScore = rightName === normalizedQuery ? 0 : rightName.startsWith(normalizedQuery) ? 1 : 2;
        return leftScore - rightScore || leftName.localeCompare(rightName);
      })
      .slice(0, limit)
      .map((product) => ({
        ...product,
        inStockListings: product.listings.filter((listing) => listing.stockStatus !== 'out_of_stock').length,
      }));
    const products = suggestionProducts.map((product) => ({
      kind: 'product' as const,
      slug: product.slug,
      label: product.name,
      image: product.images?.[0] ?? null,
      publisher: product.publisher ?? null,
      category: product.category ?? null,
      minPlayers: product.minPlayers ?? null,
      maxPlayers: product.maxPlayers ?? null,
      playTimeMinutes: product.playTimeMinutes ?? null,
      bggRating: product.bggRating ?? null,
      inStock: product.inStockListings > 0,
    }));

    const publishers = [...new Set(products.map((product) => product.publisher).filter((value): value is string => Boolean(value)))]
      .slice(0, 2)
      .map((label) => ({ kind: 'publisher' as const, label, value: label }));
    const categories = [...new Set(products.map((product) => product.category).filter((value): value is string => Boolean(value)))]
      .slice(0, 2)
      .map((label) => ({ kind: 'category' as const, label, value: label }));
    const mechanics = [...new Set(suggestionProducts.flatMap((product) => product.tags ?? []))]
      .slice(0, 2)
      .map((label) => ({ kind: 'mechanic' as const, label, value: label }));

    return { products, mechanics, publishers, categories };
  }

  /** Distinct categories with at least one active listing — backs the marketplace's category-browse tiles. */
  async getCategories(): Promise<{ category: string; count: number }[]> {
    const rows = await this.prisma.mktProduct.groupBy({
      by: ['category'],
      where: { canonicalStatus: 'verified', listings: { some: { active: true } } },
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
    });
    return rows.map((r) => ({ category: r.category, count: r._count.category }));
  }

  async getProduct(slug: string, locale?: string) {
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

    const localized = (await this.getProductLocalizations([product.id], locale)).get(product.id);

    return {
      id: product.id,
      slug: product.slug,
      name: localized?.title ?? product.name,
      category: product.category,
      description: localized?.description ?? product.description,
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

function normalizeSort(sortBy?: string): string | undefined {
  switch (sortBy) {
    case 'price_asc': return 'minPriceMinor:asc';
    case 'price_desc': return 'minPriceMinor:desc';
    case 'name': return 'name:asc';
    case 'rank_score': return 'inStockListings:desc,bggRating:desc';
    default: return undefined;
  }
}
