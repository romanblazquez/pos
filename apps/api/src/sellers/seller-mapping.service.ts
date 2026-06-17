import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { MktCatalogService } from '../mkt-catalog/mkt-catalog.service.js';

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
      select: { id: true, name: true, yearPublished: true, publisher: true, bggId: true, images: true },
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
        currency: (variant?.currency as string) ?? 'MXN',
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
}
