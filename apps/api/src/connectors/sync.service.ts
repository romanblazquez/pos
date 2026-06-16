import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { MktCatalogService } from '../mkt-catalog/mkt-catalog.service.js';
import { ConnectorRegistryService } from './connector-registry.service.js';
import type { RawProduct, StockItem, PriceItem } from '@retail-os/connector-contracts';

export interface SyncResult {
  sellerId: string;
  syncType: string;
  status: 'success' | 'partial' | 'failed';
  itemsSynced: number;
  itemsFailed: number;
  errors: string[];
  durationMs: number;
}

@Injectable()
export class ConnectorSyncService {
  private readonly log = new Logger(ConnectorSyncService.name);

  constructor(
    @Inject(PrismaService)             private readonly prisma: PrismaService,
    @Inject(ConnectorRegistryService)  private readonly registry: ConnectorRegistryService,
    @Inject(MktCatalogService)         private readonly catalog: MktCatalogService,
  ) {}

  async syncCatalog(sellerId: string, opts?: { force?: boolean }): Promise<SyncResult> {
    const start = Date.now();
    const log = await this.startLog(sellerId, 'catalog');
    let synced = 0;
    const errors: string[] = [];

    try {
      const connector = await this.registry.forSeller(sellerId);

      // Incremental: use the completedAt of the last successful catalog sync as cursor.
      // Pass force=true to bypass and pull the full catalog.
      let cursor: string | undefined;
      if (!opts?.force) {
        const last = await this.prisma.connectorSyncLog.findFirst({
          where: { sellerId, syncType: 'catalog', status: 'success' },
          orderBy: { completedAt: 'desc' },
          select: { completedAt: true },
        });
        cursor = last?.completedAt?.toISOString();
      }

      const mode = cursor ? `incremental since ${cursor}` : 'full';
      this.log.log(`[${sellerId}] catalog sync starting (${mode})`);

      for await (const batch of connector.fetchCatalog(sellerId, cursor)) {
        for (const raw of batch) {
          try {
            await this.upsertListing(sellerId, raw);
            synced++;
          } catch (err) {
            errors.push(`${raw.externalId}: ${String(err)}`);
          }
        }
      }

      await this.finishLog(log.id, 'success', synced, errors.length, errors);
      this.log.log(`[${sellerId}] catalog sync done (${mode}): ${synced} products`);
      return this.result(sellerId, 'catalog', 'success', synced, errors, start);
    } catch (err) {
      const msg = String(err);
      await this.finishLog(log.id, 'failed', synced, 1, [msg]);
      this.log.error(`[${sellerId}] catalog sync failed: ${msg}`);
      return this.result(sellerId, 'catalog', 'failed', synced, [msg], start);
    }
  }

  /** Last sync result per type, used by the sync status dashboard widget. */
  async getSyncStatus(sellerId: string) {
    const types = ['catalog', 'inventory', 'prices'] as const;
    const rows = await this.prisma.connectorSyncLog.findMany({
      where: {
        sellerId,
        syncType: { in: [...types] },
        status: { not: 'running' },
      },
      orderBy: { completedAt: 'desc' },
      distinct: ['syncType'],
      select: {
        syncType: true,
        status: true,
        itemsSynced: true,
        itemsFailed: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const byType = Object.fromEntries(rows.map((r) => [r.syncType, r]));
    return types.map((t) => ({
      type: t,
      lastRun: byType[t]?.completedAt ?? null,
      status: byType[t]?.status ?? null,
      itemsSynced: byType[t]?.itemsSynced ?? 0,
      itemsFailed: byType[t]?.itemsFailed ?? 0,
    }));
  }

  async syncInventory(sellerId: string): Promise<SyncResult> {
    const start = Date.now();
    const log = await this.startLog(sellerId, 'inventory');
    let synced = 0;
    const errors: string[] = [];

    try {
      const connector = await this.registry.forSeller(sellerId);
      const items: StockItem[] = await connector.fetchInventory(sellerId);

      for (const item of items) {
        try {
          await this.prisma.listing.updateMany({
            where: { sellerId, sellerProductId: item.externalId },
            data: {
              stock: item.stock,
              stockStatus: item.status,
              lastSyncedAt: new Date(),
            },
          });
          synced++;
        } catch (err) {
          errors.push(`${item.externalId}: ${String(err)}`);
        }
      }

      // After inventory update, re-sync affected products to search index
      await this.reindexSellerProducts(sellerId);

      await this.finishLog(log.id, 'success', synced, errors.length, errors);
      return this.result(sellerId, 'inventory', 'success', synced, errors, start);
    } catch (err) {
      const msg = String(err);
      await this.finishLog(log.id, 'failed', synced, 1, [msg]);
      return this.result(sellerId, 'inventory', 'failed', synced, [msg], start);
    }
  }

  async syncPrices(sellerId: string): Promise<SyncResult> {
    const start = Date.now();
    const log = await this.startLog(sellerId, 'prices');
    let synced = 0;
    const errors: string[] = [];

    try {
      const connector = await this.registry.forSeller(sellerId);
      const items: PriceItem[] = await connector.fetchPrices(sellerId);

      for (const item of items) {
        try {
          await this.prisma.listing.updateMany({
            where: { sellerId, sellerProductId: item.externalId },
            data: {
              priceMinorUnits: item.priceMinorUnits,
              currency: item.currency,
              lastSyncedAt: new Date(),
            },
          });
          synced++;
        } catch (err) {
          errors.push(`${item.externalId}: ${String(err)}`);
        }
      }

      await this.reindexSellerProducts(sellerId);
      await this.finishLog(log.id, 'success', synced, errors.length, errors);
      return this.result(sellerId, 'prices', 'success', synced, errors, start);
    } catch (err) {
      const msg = String(err);
      await this.finishLog(log.id, 'failed', synced, 1, [msg]);
      return this.result(sellerId, 'prices', 'failed', synced, [msg], start);
    }
  }

  private async upsertListing(sellerId: string, raw: RawProduct): Promise<void> {
    const variant = raw.variants?.[0];
    if (!variant) return;

    // Try to find a matching marketplace product by name (fuzzy for now; Epic 4 adds BGG matching)
    let product = await this.prisma.mktProduct.findFirst({
      where: { name: { contains: raw.name, mode: 'insensitive' } },
    });

    if (!product) {
      // Create a pending product — admin will review and match to BGG canonical
      const slug = this.slugify(raw.name) + '-' + Date.now();
      product = await this.prisma.mktProduct.create({
        data: {
          slug,
          name: raw.name,
          description: raw.description,
          images: raw.images,
          category: raw.category ?? 'board-game',
          tags: raw.tags ?? [],
          canonicalStatus: 'pending', // needs admin review
        },
      });
    }

    // Upsert the listing for this seller × product.
    // Some Tiendanube products share the same SKU across variants; check both
    // sellerProductId and sellerSku so we update rather than collision-create.
    const existing = await this.prisma.listing.findFirst({
      where: {
        sellerId,
        OR: [
          { sellerProductId: raw.externalId },
          ...(variant.sku ? [{ sellerSku: variant.sku }] : []),
        ],
      },
    });

    const stock = variant.stock ?? 0;
    const stockStatus = stock === 0 ? 'out_of_stock' : stock <= 3 ? 'low_stock' : 'in_stock';

    if (existing) {
      await this.prisma.listing.update({
        where: { id: existing.id },
        data: {
          priceMinorUnits: variant.priceMinorUnits,
          currency: variant.currency,
          stock,
          stockStatus,
          lastSyncedAt: new Date(),
          active: true,
        },
      });
    } else {
      await this.prisma.listing.create({
        data: {
          sellerId,
          productId: product.id,
          sellerProductId: raw.externalId,
          sellerSku: variant.sku,
          sellerUrl: raw.url,
          priceMinorUnits: variant.priceMinorUnits,
          currency: variant.currency,
          stock,
          stockStatus,
          lastSyncedAt: new Date(),
          active: true,
        },
      });
    }

    // Keep search index fresh
    await this.catalog.syncToSearch(product.id);
  }

  private async reindexSellerProducts(sellerId: string): Promise<void> {
    const listings = await this.prisma.listing.findMany({
      where: { sellerId },
      select: { productId: true },
      distinct: ['productId'],
    });
    for (const { productId } of listings) {
      await this.catalog.syncToSearch(productId).catch(() => null);
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async startLog(sellerId: string, syncType: string) {
    // Verify seller exists first — stale sessions can pass a deleted sellerId
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true, connectorType: true },
    });
    if (!seller) throw new Error(`Seller ${sellerId} not found — please log out and log in again`);

    return this.prisma.connectorSyncLog.create({
      data: {
        sellerId,
        connectorType: seller.connectorType ?? 'unknown',
        syncType,
        status: 'running',
      },
    });
  }

  private async finishLog(
    id: string,
    status: string,
    synced: number,
    failed: number,
    errors: string[],
  ) {
    await this.prisma.connectorSyncLog.update({
      where: { id },
      data: {
        status,
        itemsSynced: synced,
        itemsFailed: failed,
        errors: errors.length ? errors : undefined,
        completedAt: new Date(),
      },
    });
  }

  private result(
    sellerId: string,
    syncType: string,
    status: 'success' | 'partial' | 'failed',
    synced: number,
    errors: string[],
    startMs: number,
  ): SyncResult {
    return {
      sellerId,
      syncType,
      status,
      itemsSynced: synced,
      itemsFailed: errors.length,
      errors,
      durationMs: Date.now() - startMs,
    };
  }
}
