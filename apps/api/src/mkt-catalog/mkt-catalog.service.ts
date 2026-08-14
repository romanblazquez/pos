import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { DEFAULT_CURRENCY_CODE } from '../markets/default-market.constants.js';
import { ProductIndexerService } from '../search/product-indexer.service.js';
import { BggService } from './bgg.service.js';
import type { RankedGame } from './bgg-scraper-client.service.js';

export interface ImportByBggIdResult {
  bggId: string;
  productId: string;
  name: string;
  slug: string;
  created: boolean;
}

export interface BulkImportResult {
  imported: ImportByBggIdResult[];
  failed: { bggId: string; reason: string }[];
}

export interface RanksDumpImportResult {
  imported: number;
  skipped: number;
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
export class MktCatalogService {
  private readonly log = new Logger(MktCatalogService.name);

  constructor(
    @Inject(PrismaService)   private readonly prisma: PrismaService,
    @Inject(ProductIndexerService) private readonly indexer: ProductIndexerService,
    @Inject(BggService)       private readonly bgg: BggService,
  ) {}

  /**
   * Import a single game by BGG ID, enriching from the BGG API.
   * `status` controls the resulting canonicalStatus — bulk discovery imports use
   * 'pending' so ~150k auto-imported games don't go live without review.
   */
  async importByBggId(bggId: string, status: string = 'verified'): Promise<ImportByBggIdResult> {
    const game = await this.bgg.getGame(bggId);
    if (!game) throw new Error(`BGG game ${bggId} not found`);

    let slug = slugify(game.name);

    // Ensure slug uniqueness when BGG game has unusual characters
    const existing = await this.prisma.mktProduct.findUnique({ where: { bggId } });
    if (existing) {
      // Already exists — update enrichment fields
      const updated = await this.prisma.mktProduct.update({
        where: { bggId },
        data: {
          name: game.name,
          description: game.description || undefined,
          publisher: game.publisher || undefined,
          designer: game.designer || undefined,
          yearPublished: game.yearPublished || undefined,
          minPlayers: game.minPlayers || undefined,
          maxPlayers: game.maxPlayers || undefined,
          minAge: game.minAge || undefined,
          playTimeMinutes: game.playTimeMinutes || undefined,
          bggRating: game.rating || undefined,
          bggWeight: game.weight || undefined,
          images: game.image ? [game.image] : existing.images,
          tags: [...game.categories, ...game.mechanics].slice(0, 12),
          mechanics: game.mechanics,
          canonicalStatus: status,
        },
      });
      await this.syncToSearch(updated.id);
      return { bggId, productId: updated.id, name: updated.name, slug: updated.slug, created: false };
    }

    // Check slug uniqueness
    const slugConflict = await this.prisma.mktProduct.findUnique({ where: { slug } });
    if (slugConflict) slug = `${slug}-${bggId}`;

    const created = await this.prisma.mktProduct.create({
      data: {
        slug,
        name: game.name,
        description: game.description || undefined,
        bggId,
        category: game.categories[0] ?? 'board-game',
        publisher: game.publisher || undefined,
        designer: game.designer || undefined,
        yearPublished: game.yearPublished || undefined,
        minPlayers: game.minPlayers || undefined,
        maxPlayers: game.maxPlayers || undefined,
        minAge: game.minAge || undefined,
        playTimeMinutes: game.playTimeMinutes || undefined,
        bggRating: game.rating || undefined,
        bggWeight: game.weight || undefined,
        images: game.image ? [game.image] : [],
        tags: [...game.categories, ...game.mechanics].slice(0, 12),
        mechanics: game.mechanics,
        canonicalStatus: status,
      },
    });

    await this.syncToSearch(created.id);
    this.log.log(`Imported: ${created.name} (BGG ${bggId})`);

    return { bggId, productId: created.id, name: created.name, slug: created.slug, created: true };
  }

  /** Bulk import list of BGG IDs — continues on individual failures. */
  async bulkImport(bggIds: string[]): Promise<BulkImportResult> {
    const result: BulkImportResult = { imported: [], failed: [] };
    for (const id of bggIds) {
      try {
        const r = await this.importByBggId(id);
        result.imported.push(r);
        // Respect BGG rate limit — 1 req/sec
        await new Promise((r) => setTimeout(r, 1100));
      } catch (err) {
        result.failed.push({ bggId: id, reason: String(err) });
      }
    }
    return result;
  }

  /**
   * Bulk-import BGG's full ranks dump (~178k games) directly — no per-item API calls,
   * so none of the BGG XML API's rate limit or registration requirements apply.
   * Lands everything as 'pending' (see importByBggId for why) and never downgrades an
   * already-reviewed product's status on re-import.
   */
  async importFromRanksDump(
    games: RankedGame[],
    onProgress?: (progress: RanksDumpImportResult) => void,
  ): Promise<RanksDumpImportResult> {
    const CHUNK_SIZE = 50;
    const result: RanksDumpImportResult = { imported: 0, skipped: 0 };

    for (let i = 0; i < games.length; i += CHUNK_SIZE) {
      const batch = games.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        batch.map(async (g) => {
          if (!g.name) {
            result.skipped++;
            return;
          }
          const bggId = String(g.bgg_id);
          // bggId is globally unique, so suffixing the slug with it sidesteps the need
          // for a uniqueness lookup per row across 178k rows.
          const slug = `${slugify(g.name)}-${bggId}`;
          try {
            await this.prisma.mktProduct.upsert({
              where: { bggId },
              create: {
                slug,
                name: g.name,
                bggId,
                category: g.is_expansion ? 'expansion' : 'board-game',
                yearPublished: g.year_published ?? undefined,
                bggRating: g.average ?? undefined,
                bggRank: g.rank ?? undefined,
                bggUsersRated: g.users_rated ?? undefined,
                isExpansion: g.is_expansion,
                canonicalStatus: 'pending',
              },
              update: {
                // Explicit null (not ?? undefined) — Prisma treats undefined as "don't
                // touch", so a re-import that finds a previously-ranked game has since
                // become unranked needs null written through, not skipped.
                name: g.name,
                yearPublished: g.year_published,
                bggRating: g.average,
                bggRank: g.rank,
                bggUsersRated: g.users_rated,
                isExpansion: g.is_expansion,
              },
            });
            result.imported++;
          } catch (err) {
            this.log.warn(`Ranks-dump upsert failed for BGG ${bggId}: ${String(err)}`);
            result.skipped++;
          }
        }),
      );
      onProgress?.(result);
    }

    this.log.log(`Ranks-dump import complete: ${result.imported} imported, ${result.skipped} skipped`);
    return result;
  }

  /** Search BGG by name and return candidates (for admin catalog matching UI). */
  searchBgg(query: string) {
    return this.bgg.searchGames(query);
  }

  /** Re-sync a product's Typesense document (call after listing changes too). */
  async syncToSearch(productId: string): Promise<void> {
    await this.indexer.syncProduct(productId);
  }

  /**
   * List products with pagination — ranked (by BGG rank, nulls last) so the games
   * most worth reviewing/enriching first surface at the top of the pending queue.
   */
  async list(params: { limit?: number; offset?: number; status?: string; search?: string }) {
    const where = {
      ...(params.status ? { canonicalStatus: params.status } : {}),
      ...(params.search ? { name: { contains: params.search, mode: 'insensitive' as const } } : {}),
    };
    const [products, total] = await Promise.all([
      this.prisma.mktProduct.findMany({
        where,
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
        orderBy: [{ bggRank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
        select: {
          id: true, slug: true, name: true, bggId: true, description: true,
          publisher: true, canonicalStatus: true, images: true,
          bggRank: true, bggRating: true, yearPublished: true, isExpansion: true,
          _count: { select: { listings: true } },
        },
      }),
      this.prisma.mktProduct.count({ where }),
    ]);
    return { products, total };
  }

  // ── Seller mapping-request review queue (escalated SellerProductMapping rows) ──

  async listMappingRequests(params: { status?: string; sellerId?: string; limit?: number; offset?: number }) {
    const where = {
      status: params.status ?? 'escalated',
      ...(params.sellerId ? { sellerId: params.sellerId } : {}),
    };
    const [requests, total] = await Promise.all([
      this.prisma.sellerProductMapping.findMany({
        where,
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
        orderBy: { createdAt: 'asc' },
        include: { seller: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.sellerProductMapping.count({ where }),
    ]);
    return { requests, total };
  }

  async getMappingRequest(id: string) {
    const request = await this.prisma.sellerProductMapping.findUnique({
      where: { id },
      include: { seller: { select: { id: true, name: true, slug: true } } },
    });
    if (!request) throw new Error(`Mapping request ${id} not found`);
    return request;
  }

  /** Admin links a seller's escalated item to an existing master product. */
  async approveMappingExisting(mappingId: string, productId: string) {
    return this.resolveMappingRequest(mappingId, productId, 'admin_existing');
  }

  /** Admin imports the product fresh from BGG, then links the seller's escalated item to it. */
  async approveMappingFromBgg(mappingId: string, bggId: string) {
    const { productId } = await this.importByBggId(bggId, 'verified');
    return this.resolveMappingRequest(mappingId, productId, 'admin_new_bgg');
  }

  /** Fallback for items genuinely not on BGG (accessories, sleeves, etc.) — creates a standalone master product. */
  async approveMappingStandalone(mappingId: string, data: { name: string; category?: string; description?: string; images?: string[] }) {
    const slug = `${slugify(data.name)}-${Date.now()}`;
    const product = await this.prisma.mktProduct.create({
      data: {
        slug,
        name: data.name,
        category: data.category ?? 'board-game',
        description: data.description,
        images: data.images ?? [],
        canonicalStatus: 'verified',
      },
    });
    await this.syncToSearch(product.id);
    return this.resolveMappingRequest(mappingId, product.id, 'admin_new_standalone');
  }

  async rejectMappingRequest(mappingId: string, reason?: string) {
    return this.prisma.sellerProductMapping.update({
      where: { id: mappingId },
      data: { status: 'rejected', adminNote: reason, resolvedAt: new Date(), resolvedBy: 'admin' },
    });
  }

  private async resolveMappingRequest(mappingId: string, productId: string, matchMethod: string) {
    const mapping = await this.getMappingRequest(mappingId);
    const raw = mapping.rawPayload as Record<string, unknown>;
    const variant = (raw.variants as Record<string, unknown>[] | undefined)?.[0];

    const listing = await this.prisma.listing.create({
      data: {
        sellerId: mapping.sellerId,
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
      where: { id: mappingId },
      data: {
        status: 'manual_matched',
        productId,
        matchMethod,
        listingId: listing.id,
        resolvedAt: new Date(),
        resolvedBy: 'admin',
      },
    });

    await this.syncToSearch(productId);
    return updated;
  }
}
