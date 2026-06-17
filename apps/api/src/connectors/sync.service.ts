import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { MktCatalogService } from '../mkt-catalog/mkt-catalog.service.js';
import { ConnectorRegistryService } from './connector-registry.service.js';
import { ProductMatchingService } from './product-matching.service.js';
import type { RawProduct, StockItem, PriceItem } from '@retail-os/connector-contracts';

export interface SyncResult {
  sellerId: string;
  syncType: string;
  status: 'success' | 'partial' | 'failed';
  itemsSynced: number;
  itemsStaged: number;
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
    @Inject(ProductMatchingService)    private readonly matching: ProductMatchingService,
  ) {}

  async syncCatalog(sellerId: string, opts?: { force?: boolean }): Promise<SyncResult> {
    const start = Date.now();
    const log = await this.startLog(sellerId, 'catalog');
    let synced = 0;
    let staged = 0;
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
            const outcome = await this.upsertListing(sellerId, raw);
            if (outcome === 'staged') staged++; else synced++;
          } catch (err) {
            errors.push(`${raw.externalId}: ${String(err)}`);
          }
        }
      }

      await this.finishLog(log.id, 'success', synced, errors.length, errors);
      this.log.log(`[${sellerId}] catalog sync done (${mode}): ${synced} products, ${staged} staged for review`);
      return this.result(sellerId, 'catalog', 'success', synced, staged, errors, start);
    } catch (err) {
      const msg = String(err);
      await this.finishLog(log.id, 'failed', synced, 1, [msg]);
      this.log.error(`[${sellerId}] catalog sync failed: ${msg}`);
      return this.result(sellerId, 'catalog', 'failed', synced, staged, [msg], start);
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
      return this.result(sellerId, 'inventory', 'success', synced, 0, errors, start);
    } catch (err) {
      const msg = String(err);
      await this.finishLog(log.id, 'failed', synced, 1, [msg]);
      return this.result(sellerId, 'inventory', 'failed', synced, 0, [msg], start);
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
      return this.result(sellerId, 'prices', 'success', synced, 0, errors, start);
    } catch (err) {
      const msg = String(err);
      await this.finishLog(log.id, 'failed', synced, 1, [msg]);
      return this.result(sellerId, 'prices', 'failed', synced, 0, [msg], start);
    }
  }

  private async upsertListing(sellerId: string, raw: RawProduct): Promise<'synced' | 'staged'> {
    const variant = raw.variants?.[0];
    if (!variant) return 'synced';

    const result = await this.matching.match(sellerId, raw);

    if (result.outcome === 'needs_review') {
      // No confident match — park it for the seller to resolve manually rather
      // than minting a new (non-BGG) master product or auto-publishing a guess.
      await this.matching.stageForReview(sellerId, raw.externalId, raw, result.candidates ?? []);
      return 'staged';
    }

    const productId = result.productId!;

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

    let listingId: string;
    if (existing) {
      // Never touch `active` here — that's the seller's publish toggle, sync only syncs stock/price.
      const updated = await this.prisma.listing.update({
        where: { id: existing.id },
        data: {
          priceMinorUnits: variant.priceMinorUnits,
          currency: variant.currency,
          stock,
          stockStatus,
          lastSyncedAt: new Date(),
        },
      });
      listingId = updated.id;
    } else {
      const created = await this.prisma.listing.create({
        data: {
          sellerId,
          productId,
          sellerProductId: raw.externalId,
          sellerSku: variant.sku,
          sellerUrl: raw.url,
          priceMinorUnits: variant.priceMinorUnits,
          currency: variant.currency,
          stock,
          stockStatus,
          lastSyncedAt: new Date(),
          active: false, // unpublished until the seller explicitly confirms/publishes
        },
      });
      listingId = created.id;
    }

    if (result.outcome === 'auto_matched') {
      await this.matching.recordResolution(sellerId, raw.externalId, raw, {
        status: 'auto_matched',
        productId,
        matchMethod: 'auto',
        matchConfidence: result.confidence,
        listingId,
      });
    }

    // Keep search index fresh
    await this.catalog.syncToSearch(productId);
    return 'synced';
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
    staged: number,
    errors: string[],
    startMs: number,
  ): SyncResult {
    return {
      sellerId,
      syncType,
      status,
      itemsSynced: synced,
      itemsStaged: staged,
      itemsFailed: errors.length,
      errors,
      durationMs: Date.now() - startMs,
    };
  }
}
