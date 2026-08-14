import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { TypesenseService, type ProductDocument } from './typesense.service.js';
import { visibleSellerWhere } from '../markets/market-eligibility.js';

/**
 * The single place a product becomes a search document.
 *
 * Two callers need this — the catalogue service (on product/listing edits) and
 * the ranking scheduler (after a rank pass) — and they previously carried
 * byte-identical copies of the query, the localization fold and the field
 * mapping. Any field added to one silently skewed the index depending on which
 * path last wrote the document. One owner, one shape.
 */
export interface ListingPricing {
  minPriceMinor: number;
  maxPriceMinor: number;
  currency: string;
  currencies: string[];
}

/**
 * Collapse a product's active listings into an indexable price range.
 *
 * A range only means something inside a single currency. When a product is
 * listed in several, this returns no range rather than a minimum drawn from one
 * currency and a maximum from another — that number would be fiction, and it
 * would sort against genuinely comparable products.
 */
export function aggregateListingPricing(
  listings: ReadonlyArray<{ priceMinorUnits: number; currency: string }>,
): ListingPricing {
  const currencies = [...new Set(listings.map((listing) => listing.currency))].sort();
  const prices = listings.map((listing) => listing.priceMinorUnits);
  const comparable = currencies.length === 1 && prices.length > 0;

  return {
    minPriceMinor: comparable ? Math.min(...prices) : 0,
    maxPriceMinor: comparable ? Math.max(...prices) : 0,
    // Empty rather than a house default: inventing a currency is exactly how
    // every price ends up labelled MXN regardless of what the seller charges.
    currency: currencies.length === 1 ? currencies[0] : '',
    currencies,
  };
}

@Injectable()
export class ProductIndexerService {
  private readonly log = new Logger(ProductIndexerService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TypesenseService) private readonly search: TypesenseService,
  ) {}

  async syncProduct(productId: string): Promise<void> {
    const product = await this.prisma.mktProduct.findUnique({
      where: { id: productId },
      include: {
        listings: {
          // Same seller rule the query path enforces. `active: true` alone left
          // suspended sellers' prices and store counts on every card while the
          // product page correctly showed nothing.
          where: { active: true, seller: visibleSellerWhere() },
          orderBy: { rankScore: 'desc' },
          select: {
            priceMinorUnits: true,
            currency: true,
            stockStatus: true,
          },
        },
        // Browse-category membership, so a category page filters the index
        // rather than dropping to a narrower Prisma query.
        categories: { select: { category: { select: { normalizedName: true } } } },
      },
    });
    if (!product) return;

    // Fold approved localized copy into the search doc so queries match in both
    // languages: es-MX populates nameEs/descriptionEs, en-US overrides the base
    // English fields. Falls back to the raw BGG text when no override exists.
    const localizations = await this.prisma.entityLocalization.findMany({
      where: { entityType: 'mkt_product', entityId: product.id, moderationStatus: 'APPROVED' },
      include: { language: { select: { code: true } } },
    });
    const byCode = new Map(localizations.map((l) => [l.language.code, l]));
    const es = byCode.get('es-MX');
    const en = byCode.get('en-US');

    const listings = product.listings;
    const pricing = aggregateListingPricing(listings);

    const doc: ProductDocument = {
      id: product.id,
      slug: product.slug,
      name: en?.title ?? product.name,
      nameEs: es?.title ?? product.name,
      publisher: product.publisher ?? '',
      description: en?.description ?? product.description ?? '',
      descriptionEs: es?.description ?? product.description ?? '',
      category: product.category,
      categorySlugs: product.categories.map((link) => link.category.normalizedName),
      tags: product.tags,
      mechanics: product.mechanics,
      language: product.language ?? '',
      minPlayers: product.minPlayers ?? 0,
      maxPlayers: product.maxPlayers ?? 0,
      minAge: product.minAge ?? 0,
      playTimeMinutes: product.playTimeMinutes ?? 0,
      bggRating: product.bggRating ?? 0,
      bggWeight: product.bggWeight ?? 0,
      minPriceMinor: pricing.minPriceMinor,
      maxPriceMinor: pricing.maxPriceMinor,
      currency: pricing.currency,
      currencies: pricing.currencies,
      totalListings: listings.length,
      inStockListings: listings.filter((listing) => listing.stockStatus !== 'out_of_stock').length,
      images: product.images,
    };

    await this.search.upsertProduct(doc);
  }

  /** Best-effort variant for schedulers, where a stale index beats a failed pass. */
  async syncProductQuietly(productId: string): Promise<void> {
    try {
      await this.syncProduct(productId);
    } catch (err) {
      this.log.warn(`Failed to sync product ${productId} to search: ${String(err)}`);
    }
  }
}
