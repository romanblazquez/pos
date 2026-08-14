import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { MktCatalogService } from '../mkt-catalog/mkt-catalog.service.js';
import { DEFAULT_CURRENCY_CODE } from '../markets/default-market.constants.js';

/**
 * Seller-facing half of the product-matching pipeline: lists items that
 * synced from a connector but couldn't be confidently matched to the master
 * catalog, and lets the seller resolve them (link to a candidate, search
 * manually, or escalate to admin for a new-product request).
 */
@Injectable()
export class SellerMappingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MktCatalogService) private readonly catalog: MktCatalogService,
  ) {}

  async list(sellerId: string, params: { status?: string; limit?: number; offset?: number }) {
    const where = { sellerId, status: params.status ?? 'pending_review' };
    const [mappings, total] = await Promise.all([
      this.prisma.sellerProductMapping.findMany({
        where,
        take: params.limit ?? 24,
        skip: params.offset ?? 0,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.sellerProductMapping.count({ where }),
    ]);
    return { mappings, total };
  }

  /** Search the master catalog by name, for the seller's manual-link search box. */
  async searchCatalog(q: string, limit = 8) {
    if (!q.trim()) return [];
    return this.prisma.mktProduct.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      take: limit,
      // `slug` is here for the manual create-listing picker, which addresses
      // products by slug like the rest of the public product API; relink still
      // uses `id`.
      select: { id: true, slug: true, name: true, yearPublished: true, publisher: true, bggId: true, images: true },
    });
  }

  private async getOwnedMapping(sellerId: string, mappingId: string) {
    const mapping = await this.prisma.sellerProductMapping.findUnique({ where: { id: mappingId } });
    if (!mapping || mapping.sellerId !== sellerId) {
      throw new NotFoundException(`Mapping ${mappingId} not found for this seller`);
    }
    return mapping;
  }

  /** Seller picks a candidate (or a manual search result) to link the item to. */
  async link(sellerId: string, mappingId: string, productId: string) {
    const mapping = await this.getOwnedMapping(sellerId, mappingId);
    const raw = mapping.rawPayload as Record<string, unknown>;
    const variant = (raw.variants as Record<string, unknown>[] | undefined)?.[0];

    const listing = await this.prisma.listing.create({
      data: {
        sellerId,
        productId,
        sellerProductId: mapping.sellerProductId ?? undefined,
        sellerSku: mapping.sellerSku ?? undefined,
        sellerUrl: (raw.url as string) ?? undefined,
        priceMinorUnits: (variant?.priceMinorUnits as number) ?? 0,
        currency: (variant?.currency as string) ?? DEFAULT_CURRENCY_CODE,
        stock: (variant?.stock as number) ?? 0,
        lastSyncedAt: new Date(),
        active: false, // unpublished until the seller explicitly publishes
      },
    });

    const updated = await this.prisma.sellerProductMapping.update({
      where: { id: mapping.id },
      data: {
        status: 'manual_matched',
        productId,
        matchMethod: 'seller_manual',
        matchConfidence: null,
        listingId: listing.id,
        resolvedAt: new Date(),
        resolvedBy: `seller:${sellerId}`,
      },
    });

    await this.catalog.syncToSearch(productId);
    return updated;
  }

  /** Seller couldn't find a match — escalate to the admin review queue. */
  async escalate(sellerId: string, mappingId: string, note?: string) {
    await this.getOwnedMapping(sellerId, mappingId);
    return this.prisma.sellerProductMapping.update({
      where: { id: mappingId },
      data: { status: 'escalated', sellerNote: note },
    });
  }

  /** Seller dismisses an item without escalating (e.g. duplicate/irrelevant). */
  async dismiss(sellerId: string, mappingId: string) {
    await this.getOwnedMapping(sellerId, mappingId);
    return this.prisma.sellerProductMapping.update({
      where: { id: mappingId },
      data: { status: 'rejected', resolvedAt: new Date(), resolvedBy: `seller:${sellerId}` },
    });
  }

  /**
   * Re-pair an already-matched listing to a different master product — covers
   * "this was auto/manually matched wrong, let me fix it" from the listings page,
   * as opposed to the initial-match flow above.
   */
  async relinkListing(sellerId: string, listingId: string, newProductId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerId !== sellerId) {
      throw new NotFoundException(`Listing ${listingId} not found for this seller`);
    }
    const previousProductId = listing.productId;

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { productId: newProductId },
      include: { product: true },
    });

    // Keep the mapping audit trail in sync — update if one exists (it should, for
    // anything matched through this pipeline), but don't fail re-link on legacy
    // listings that predate it.
    await this.prisma.sellerProductMapping.updateMany({
      where: { listingId },
      data: {
        productId: newProductId,
        matchMethod: 'seller_manual',
        matchConfidence: null,
        status: 'manual_matched',
        resolvedAt: new Date(),
        resolvedBy: `seller:${sellerId}`,
      },
    });

    await Promise.all([
      this.catalog.syncToSearch(newProductId),
      this.catalog.syncToSearch(previousProductId),
    ]);

    return updated;
  }
}
