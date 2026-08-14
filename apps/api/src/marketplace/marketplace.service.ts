import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { TypesenseService } from '../search/typesense.service.js';
import { SemanticSearchService } from '../search/semantic-search.service.js';
import {
  MARKET_COMMERCE,
  SELLER_VISIBLE_STATUS,
  eligibleListingWhere,
  marketConfig,
  marketCurrency,
  summariseForeignAvailability,
  withMarketPricing,
} from '../markets/market-eligibility.js';
import {
  normalizeAvailabilityRequest,
  type AvailabilityRequestError,
} from './availability-request.js';
import { DEFAULT_CURRENCY_CODE } from '../markets/default-market.constants.js';
import { COMPLEXITY_BAND_RANGES, isComplexityBand, bandForWeight } from './complexity-bands.js';

export interface ProductSearchParams {
  q?: string;
  category?: string;
  publisher?: string;
  yearPublished?: number;
  minAge?: number;
  playTimeMinutes?: number;
  minPlayers?: number;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  mechanics?: string[];
  complexity?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  semantic?: boolean;
  /** Market whose offers may be priced. Cards outside it fall back to "no offer". */
  market?: string;
  /**
   * Currency filter: show only products offered in these currencies, priced as
   * the seller quotes them. A filter, never a converter — selecting ARS shows
   * real Argentine offers, it does not restate Mexican ones in pesos argentinos.
   */
  currencies?: string[];
  /** Show only products with an active listing from this seller (slug). */
  seller?: string;
}

// searchProducts and semanticSearchProducts call each other (semantic falls back
// to the lexical path when it finds nothing), so both need an explicit shared
// return type — without it TypeScript can't break the mutual-recursion cycle and
// infers `any`. Results are serialized straight to JSON, so the element shape
// (Typesense hit / hydrated product / db summary) is intentionally untyped here.
export interface ProductSearchResult {
  results: unknown[];
  total: number;
  source: 'search' | 'semantic' | 'db';
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
    @Inject(SemanticSearchService) private readonly semantic: SemanticSearchService,
  ) {}

  async semanticSearchProducts(query: string, locale?: string, limit = 24): Promise<ProductSearchResult> {
    const hits = await this.semantic.search(query, locale, limit);
    if (hits.length === 0) return this.searchProducts({ q: query, limit }, locale);
    const results = await this.hydrateSemanticHits(hits.map((hit) => hit.canonicalId), locale);
    return { results, total: results.length, source: 'semantic' as const };
  }

  private async hydrateSemanticHits(ids: string[], locale?: string, market?: string) {
    if (ids.length === 0) return [];
    const products = await this.prisma.mktProduct.findMany({
      where: { id: { in: ids }, canonicalStatus: 'verified', listings: { some: { active: true } } },
      include: {
        listings: {
          where: { active: true },
          select: { priceMinorUnits: true, currency: true, stockStatus: true },
        },
      },
    });
    const localizations = await this.getProductLocalizations(ids, locale);
    const order = new Map(ids.map((id, index) => [id, index]));
    return products.map((product) => {
      const localized = localizations.get(product.id);
      const prices = product.listings.map((listing) => listing.priceMinorUnits);
      return {
        id: product.id,
        slug: product.slug,
        name: localized?.title ?? product.name,
        description: localized?.description ?? product.description,
        images: product.images,
        category: product.category,
        tags: product.tags,
        publisher: product.publisher,
        minPlayers: product.minPlayers,
        maxPlayers: product.maxPlayers,
        minAge: product.minAge,
        playTimeMinutes: product.playTimeMinutes,
        bggRating: product.bggRating,
        bggWeight: product.bggWeight,
        language: product.language,
        minPriceMinor: prices.length ? Math.min(...prices) : 0,
        maxPriceMinor: prices.length ? Math.max(...prices) : 0,
        currency: product.listings[0]?.currency ?? DEFAULT_CURRENCY_CODE,
        totalListings: product.listings.length,
        inStockListings: product.listings.filter((listing) => listing.stockStatus !== 'out_of_stock').length,
      };
    })
      .map((product) => withMarketPricing(product, market))
      .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  }

  /**
   * Approved title/description overrides for the given product ids, keyed by
   * entityId. Returns an empty map when no locale is requested, or if the
   * Language/EntityLocalization tables aren't migrated/seeded yet in this
   * environment — callers fall back to the base Spanish fields either way.
   */
  private async getProductLocalizations(
    productIds: string[],
    locale?: string,
  ): Promise<Map<string, { title: string; description: string | null }>> {
    if (!locale || productIds.length === 0) return new Map();
    try {
      // Language.code is the full locale tag (e.g. 'en-US'); iso6391 is the
      // canonical 2-letter lookup for the primary regional variant.
      const iso6391 = locale.toLowerCase().split('-')[0];
      const language = await this.prisma.language.findFirst({
        where: { OR: [{ code: locale }, { iso6391 }] },
      });
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

  async searchProducts(params: ProductSearchParams, locale?: string): Promise<ProductSearchResult> {
    const { q = '', limit = 24, offset = 0 } = params;

    if (params.semantic && q && !hasStructuredFilters(params)) {
      return this.semanticSearchProducts(q, locale, limit);
    }

    // Typesense does not index the long-tail SEO facets yet. Route those filters
    // through Prisma so a requested facet is never silently ignored; the ordinary
    // query remains fast and ranked. `category` is NOT one of them any more — the
    // index carries `categorySlugs`, so a category page pages over the same
    // catalogue the rest of the storefront searches (the Prisma path sees only
    // verified products with an active listing, which made a category of 466
    // games render as 11 and its pagination collapse to a single page).
    const databaseOnlyFilters = Boolean(
      params.publisher || params.yearPublished || params.minAge || params.playTimeMinutes,
    );
    const { hits, total } = databaseOnlyFilters ? { hits: [], total: 0 } : await this.search.search({
      q,
      category: params.category,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minPlayers: params.minPlayers,
      inStockOnly: params.inStockOnly,
      mechanics: params.mechanics,
      complexity: params.complexity,
      currencies: params.currencies,
      seller: params.seller,
      sortBy: normalizeSort(params.sortBy),
      limit,
      offset,
    });

    // `total > 0` rather than `hits.length > 0`: a page past the end of a real
    // result set has no hits but is still a correct, empty page. Handing it to
    // the Prisma fallback instead would answer the last+1 page of a category
    // with a different, much narrower set — and a different total.
    if (total > 0) {
      const localizations = await this.getProductLocalizations(hits.map((hit) => hit.id), locale);
      const localizedHits = hits.map((hit) => {
        const localized = localizations.get(hit.id);
        const named = localized ? {
          ...hit,
          name: localized.title,
          description: localized.description ?? hit.description,
        } : hit;
        return withMarketPricing(named, params.market);
      });
      return { results: localizedHits, total, source: 'search' as const };
    }

    // Prisma fallback — when Typesense is empty or unavailable
    const listingFilter = {
      active: true,
      ...(params.seller ? { seller: { slug: params.seller } } : {}),
      ...(params.inStockOnly ? { stockStatus: { not: 'out_of_stock' } } : {}),
      ...((params.minPrice !== undefined || params.maxPrice !== undefined) ? {
        priceMinorUnits: {
          ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
          ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
        },
      } : {}),
    };

    const complexityRange = params.complexity && isComplexityBand(params.complexity)
      ? COMPLEXITY_BAND_RANGES[params.complexity]
      : undefined;

    const where = {
      canonicalStatus: 'verified' as const,
      AND: [
        ...(params.category ? [{ OR: [
          { category: params.category },
          { categories: { some: { category: { normalizedName: params.category } } } },
        ] }] : []),
        ...(params.publisher ? [{ OR: [
          { publisher: { equals: params.publisher, mode: 'insensitive' as const } },
          { publisherEntity: { normalizedName: params.publisher } },
          { publisherEntity: { canonicalName: { equals: params.publisher, mode: 'insensitive' as const } } },
        ] }] : []),
        ...(q ? [{ OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { publisher: { contains: q, mode: 'insensitive' as const } },
          { designer: { contains: q, mode: 'insensitive' as const } },
          { description: { contains: q, mode: 'insensitive' as const } },
          { tags: { has: q } },
        ] }] : []),
      ],
      ...(params.yearPublished ? { yearPublished: params.yearPublished } : {}),
      ...(params.minAge ? { minAge: params.minAge } : {}),
      ...(params.playTimeMinutes ? { playTimeMinutes: params.playTimeMinutes } : {}),
      ...(params.minPlayers ? {
        minPlayers: { lte: params.minPlayers },
        maxPlayers: { gte: params.minPlayers },
      } : {}),
      ...(params.mechanics && params.mechanics.length > 0 ? { mechanics: { hasSome: params.mechanics } } : {}),
      ...(complexityRange ? {
        bggWeight: {
          gte: complexityRange.min,
          ...(complexityRange.max !== null ? { lt: complexityRange.max } : {}),
        },
      } : {}),
      listings: { some: listingFilter },
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

    return {
      results: results.map((r) => withMarketPricing(r, params.market)),
      total: totalCount,
      source: 'db' as const,
    };
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
    const mechanics = [...new Set(suggestionProducts.flatMap((product) => product.mechanics ?? []))]
      .slice(0, 2)
      .map((label) => ({ kind: 'mechanic' as const, label, value: label }));

    return { products, mechanics, publishers, categories };
  }

  /**
   * Categories that currently hold products, with counts — backs the browse
   * tiles and filter chips.
   *
   * Counted from the search index, because that is the set a category page
   * paginates over: counting verified-with-active-listing products instead made
   * a chip read "11" and its page then list 886. The database aggregation stays
   * as the fallback for an empty or unreachable index.
   */
  async getCategories(): Promise<{ category: string; count: number }[]> {
    const indexed = await this.search.categoryCounts();
    if (indexed.size > 0) {
      return [...indexed.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
    }

    const [normalized, legacy] = await Promise.all([
      this.prisma.category.findMany({
        where: { marketplaceProducts: { some: { product: { canonicalStatus: 'verified', listings: { some: { active: true } } } } } },
        select: {
          normalizedName: true,
          _count: { select: { marketplaceProducts: { where: { product: { canonicalStatus: 'verified', listings: { some: { active: true } } } } } } },
        },
      }),
      this.prisma.mktProduct.groupBy({
      by: ['category'],
      where: { canonicalStatus: 'verified', listings: { some: { active: true } } },
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
      }),
    ]);
    const counts = new Map(legacy.map((row) => [row.category, row._count.category]));
    for (const row of normalized) counts.set(row.normalizedName, row._count.marketplaceProducts);
    return [...counts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
  }

  /**
   * Distinct game mechanics (MktProduct.mechanics — real mechanics only, not
   * the blended `tags`), ordered by popularity — backs the mechanics filter
   * chips AND the /mecanicas landing pages. Reads the Typesense index first,
   * same as getCategories(): the encyclopedia's indexable catalogue is
   * overwhelmingly larger than the handful of products with an active seller
   * listing, and a plain verified+active Prisma query undercounted mechanics
   * by two orders of magnitude. Falls back to the narrow verified+active-
   * listing count only when the index is empty or unreachable.
   */
  async getMechanics(): Promise<{ mechanic: string; count: number }[]> {
    const indexed = await this.search.mechanicCounts();
    if (indexed.size > 0) {
      return [...indexed.entries()]
        .map(([mechanic, count]) => ({ mechanic, count }))
        .sort((a, b) => b.count - a.count || a.mechanic.localeCompare(b.mechanic));
    }

    const products = await this.prisma.mktProduct.findMany({
      where: { canonicalStatus: 'verified', listings: { some: { active: true } } },
      select: { mechanics: true },
    });
    const counts = new Map<string, number>();
    for (const product of products) {
      for (const mechanic of product.mechanics) {
        counts.set(mechanic, (counts.get(mechanic) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([mechanic, count]) => ({ mechanic, count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Compact, cache-friendly facet vocabulary for the server-rendered filters. */
  async getFacets() {
    const active = { canonicalStatus: 'verified' as const, listings: { some: { active: true } } };
    const [indexedPublishers, years, ages, durations] = await Promise.all([
      this.search.publisherCounts(),
      this.prisma.mktProduct.groupBy({ by: ['yearPublished'], where: { ...active, yearPublished: { not: null } }, _count: { _all: true }, orderBy: { yearPublished: 'desc' } }),
      this.prisma.mktProduct.groupBy({ by: ['minAge'], where: { ...active, minAge: { not: null } }, _count: { _all: true }, orderBy: { minAge: 'asc' } }),
      this.prisma.mktProduct.groupBy({ by: ['playTimeMinutes'], where: { ...active, playTimeMinutes: { not: null } }, _count: { _all: true }, orderBy: { playTimeMinutes: 'asc' } }),
    ]);

    // Same reasoning as getMechanics(): the publisher hub/landing pages need
    // the full indexed encyclopedia, not just products with an active seller
    // listing. Falls back to the old verified+active groupBy when the index
    // is empty or unreachable.
    //
    // BGG's own publisher credit isn't always a real publisher — "(Self-
    // Published)", "(Web published)", "(Unknown)" etc. are BGG's catch-all
    // placeholders for games without one, always bracketed. A landing page
    // for "(Unknown)" isn't a useful entity page, so those are filtered here
    // rather than at ingestion (still wanted verbatim for search/filtering).
    const isRealPublisher = (value: string) => !value.startsWith('(');
    let publishers: { value: string; count: number }[];
    if (indexedPublishers.size > 0) {
      publishers = [...indexedPublishers.entries()]
        .filter(([value]) => isRealPublisher(value))
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    } else {
      const rows = await this.prisma.mktProduct.groupBy({ by: ['publisher'], where: { ...active, publisher: { not: null } }, _count: { _all: true }, orderBy: { _count: { publisher: 'desc' } }, take: 100 });
      publishers = rows.filter((row) => row.publisher && isRealPublisher(row.publisher)).map((row) => ({ value: row.publisher!, count: row._count._all }));
    }

    return {
      publishers,
      years: years.filter((row) => row.yearPublished != null).map((row) => ({ value: row.yearPublished!, count: row._count._all })),
      ages: ages.filter((row) => row.minAge != null).map((row) => ({ value: row.minAge!, count: row._count._all })),
      durations: durations.filter((row) => row.playTimeMinutes != null).map((row) => ({ value: row.playTimeMinutes!, count: row._count._all })),
    };
  }

  /**
   * Public seller directory — backs the /tiendas storefront hub. Only
   * `active` sellers (never pending/suspended/churned — see
   * SELLER_VISIBLE_STATUS) with at least one indexed product are listed;
   * a suspended seller isn't a storefront anyone should land on.
   */
  async getSellers(): Promise<Array<{ slug: string; name: string; logoUrl: string | null; description: string | null; productCount: number }>> {
    const sellers = await this.prisma.seller.findMany({
      where: { status: SELLER_VISIBLE_STATUS },
      select: { id: true, slug: true, name: true, logoUrl: true, description: true },
    });

    const indexed = await this.search.sellerCounts();
    const countBySlug = indexed.size > 0
      ? indexed
      : await (async () => {
        // Fallback groups by sellerId (Listing has no denormalized slug), so
        // translate through the sellers list already fetched above.
        const bySellerId = new Map(
          (await this.prisma.listing.groupBy({
            by: ['sellerId'],
            where: { active: true, seller: { status: SELLER_VISIBLE_STATUS } },
            _count: { _all: true },
          })).map((row) => [row.sellerId, row._count._all]),
        );
        return new Map(sellers.map((s) => [s.slug, bySellerId.get(s.id) ?? 0]));
      })();

    return sellers
      .map(({ id: _id, ...seller }) => ({ ...seller, productCount: countBySlug.get(seller.slug) ?? 0 }))
      .filter((seller) => seller.productCount > 0)
      .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
  }

  /** Public seller profile — backs /tiendas/{slug}. Null for anything not `active`. */
  async getSeller(slug: string): Promise<{ slug: string; name: string; logoUrl: string | null; description: string | null; productCount: number } | null> {
    const seller = await this.prisma.seller.findFirst({
      where: { slug, status: SELLER_VISIBLE_STATUS },
      select: { slug: true, name: true, logoUrl: true, description: true },
    });
    if (!seller) return null;

    const indexed = await this.search.sellerCounts();
    const productCount = indexed.size > 0
      ? (indexed.get(slug) ?? 0)
      : await this.prisma.listing.count({ where: { active: true, seller: { slug } } });

    return { ...seller, productCount };
  }

  async getProduct(slug: string, locale?: string, market?: string) {
    const product = await this.prisma.mktProduct.findUnique({
      where: { slug },
      include: {
        publisherEntity: true,
        categories: { include: { category: true }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        listings: {
          // One market, one currency — see markets/market-eligibility.ts.
          where: eligibleListingWhere(market),
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

    // Filtering must not dead-end a product. When this market has no offer we
    // still know the game is stocked elsewhere; report that as counts only.
    // A price in another market's currency is not an offer to this shopper and
    // must never be rendered as one.
    const foreignListings = await this.prisma.listing.findMany({
      where: { productId: product.id, active: true, currency: { not: marketCurrency(market) } },
      select: { currency: true },
    });
    const foreignAvailability = summariseForeignAvailability(foreignListings, market);

    return {
      id: product.id,
      slug: product.slug,
      marketCode: marketConfig(market).code,
      marketCurrency: marketCurrency(market),
      foreignAvailability,
      name: localized?.title ?? product.name,
      category: product.categories[0]?.category.normalizedName ?? product.category,
      categories: product.categories.map(({ category, isPrimary }) => ({
        slug: category.normalizedName,
        name: category.canonicalName,
        isPrimary,
      })),
      description: localized?.description ?? product.description,
      images: product.images,
      publisher: product.publisherEntity?.canonicalName ?? product.publisher,
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
      bggRank: product.bggRank,
      bggUsersRated: product.bggUsersRated,
      isExpansion: product.isExpansion,
      tags: product.tags,
      listings: product.listings.map((l) => ({
        id: l.id,
        sellerId: l.sellerId,
        sellerName: l.seller.name,
        sellerSlug: l.seller.slug,
        sellerScore: l.seller.score?.compositeScore ?? 0.5,
        priceMinorUnits: l.priceMinorUnits,
        condition: l.condition,
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

  /**
   * Same-category, similar-complexity products — reuses the existing
   * category/complexity-band Typesense filters from searchProducts() rather
   * than a bespoke scoring query. Over-fetches by one and filters the source
   * product out client-side instead of adding an "exclude id" filter to
   * TypesenseService, since this is the only caller that needs it.
   */
  async getSimilarProducts(slug: string, limit = 8, locale?: string, market?: string) {
    const source = await this.prisma.mktProduct.findUnique({ where: { slug } });
    if (!source) return [];

    const semanticHits = await this.semantic.similar(source.id, locale, limit);
    if (semanticHits.length > 0) {
      return this.hydrateSemanticHits(semanticHits.map((hit) => hit.canonicalId), locale, market);
    }

    const complexity = source.bggWeight ? bandForWeight(source.bggWeight) : undefined;

    const { hits } = await this.search.search({
      q: '',
      category: source.category,
      complexity,
      sortBy: 'inStockListings:desc,bggRating:desc',
      limit: limit + 1,
    });

    const filtered = hits.filter((h) => h.id !== source.id);
    if (filtered.length > 0) {
      return filtered.slice(0, limit).map((hit) => withMarketPricing(hit, market));
    }

    // Prisma fallback — mirrors searchProducts()'s fallback for an empty/unavailable index.
    const products = await this.prisma.mktProduct.findMany({
      where: { category: source.category, id: { not: source.id }, canonicalStatus: 'verified' },
      orderBy: { bggRating: 'desc' },
      take: limit,
    });
    return products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      images: p.images,
      category: p.category,
      tags: p.tags,
      publisher: p.publisher,
      minPlayers: p.minPlayers,
      maxPlayers: p.maxPlayers,
      minAge: p.minAge,
      playTimeMinutes: p.playTimeMinutes,
      bggRating: p.bggRating,
      bggWeight: p.bggWeight,
      language: p.language,
      minPriceMinor: 0,
      maxPriceMinor: 0,
      totalListings: 0,
      inStockListings: 0,
    }));
  }

  /**
   * Live per-product sales-by-year breakdown — cheap at this catalog's order
   * volume, so computed on demand rather than cached/pre-aggregated. Only
   * counts orders that represent a real completed sale (confirmed onward),
   * not abandoned/cancelled/refunded ones.
   */
  async getSalesByYear(slug: string): Promise<{ year: number; count: number }[]> {
    const product = await this.prisma.mktProduct.findUnique({ where: { slug }, select: { id: true } });
    if (!product) return [];

    const rows = await this.prisma.$queryRaw<{ year: number; count: bigint }[]>`
      SELECT EXTRACT(YEAR FROM mo."createdAt")::int AS year, COUNT(*)::bigint AS count
      FROM "MarketplaceOrderLine" mol
      JOIN "Listing" l ON l.id = mol."listingId"
      JOIN "MarketplaceOrder" mo ON mo.id = mol."orderId"
      WHERE l."productId" = ${product.id}
        AND mo.status IN ('confirmed', 'shipped', 'delivered')
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map((r) => ({ year: r.year, count: Number(r.count) }));
  }

  /**
   * Record a shopper's request to be told when a product becomes buyable in
   * their market.
   *
   * Idempotent by (product, email, market): resubmitting returns the existing
   * request rather than creating a second one to email. The reply carries how
   * many people are waiting, which is honest feedback to the shopper ("you are
   * not the only one") and the demand signal we take to sellers.
   */
  async requestAvailability(
    slug: string,
    input: { email?: string; market?: string; locale?: string },
  ): Promise<
    | { ok: false; error: AvailabilityRequestError | 'unknown_product' }
    | { ok: true; alreadyRequested: boolean; waiting: number }
  > {
    const normalized = normalizeAvailabilityRequest(input, Object.keys(MARKET_COMMERCE));
    if (!normalized.ok) return normalized;
    const { email, marketCode, locale } = normalized.value;

    const product = await this.prisma.mktProduct.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!product) return { ok: false, error: 'unknown_product' };

    const existing = await this.prisma.productAvailabilityRequest.findUnique({
      where: {
        productId_email_marketCode: { productId: product.id, email, marketCode },
      },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.productAvailabilityRequest.create({
        data: { productId: product.id, email, marketCode, locale },
      });
    }

    const waiting = await this.prisma.productAvailabilityRequest.count({
      where: { productId: product.id, marketCode },
    });

    return { ok: true, alreadyRequested: Boolean(existing), waiting };
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

function hasStructuredFilters(params: ProductSearchParams): boolean {
  return Boolean(
    params.category || params.publisher || params.yearPublished || params.minAge || params.playTimeMinutes
    || params.minPlayers || params.minPrice !== undefined || params.maxPrice !== undefined
    || params.inStockOnly || params.mechanics?.length || params.complexity || params.sortBy,
  );
}
