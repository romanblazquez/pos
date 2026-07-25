import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '@retail-os/db-postgres';
import { TypesenseService } from '../search/typesense.service.js';
import { SemanticSearchService } from '../search/semantic-search.service.js';
import { calculateRankScore } from '@retail-os/rankings';
import type { RankingInput } from '@retail-os/rankings';

const QUEUE_NAME = 'ranking';
const JOB_NAME = 'rank-all-listings';
const SEMANTIC_JOB_NAME = 'refresh-semantic-index';

// How many listings to process in each batch (avoids loading all into memory at once)
const BATCH_SIZE = 100;

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

@Injectable()
export class RankingSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(RankingSchedulerService.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TypesenseService) private readonly search: TypesenseService,
    @Inject(SemanticSearchService) private readonly semantic: SemanticSearchService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(QUEUE_NAME, { connection: redisConnection });

    this.worker = new Worker(
      QUEUE_NAME,
      (job: Job) => job.name === SEMANTIC_JOB_NAME ? this.processSemanticJob() : this.processJob(job),
      { connection: redisConnection, concurrency: 1 },
    );

    this.worker.on('completed', (job) => {
      this.log.log(`Ranking job ${job.id} completed`);
    });
    this.worker.on('failed', (job, err) => {
      this.log.error(`Ranking job ${job?.id} failed: ${err.message}`);
    });

    // Schedule hourly recurring job (upsert so restarts don't create duplicates)
    await this.queue.upsertJobScheduler(
      'hourly-ranking',
      { every: 60 * 60 * 1000 },  // every hour
      { name: JOB_NAME },
    );

    // Product and approved-localization changes are much less frequent than
    // price/rank changes. A separate six-hour job keeps vectors fresh without
    // coupling paid embedding work to every hourly ranking pass.
    await this.queue.upsertJobScheduler(
      'six-hour-semantic-index',
      { every: 6 * 60 * 60 * 1000 },
      { name: SEMANTIC_JOB_NAME },
    );

    this.log.log('Ranking scheduler initialized — hourly ranking and six-hour semantic refresh registered');

    // Keep the search index covering the whole storefront catalogue. The hourly
    // ranking pass only reindexes products with an active listing, so a freshly
    // recreated (or under-populated) collection would drop every offer-less
    // verified product — yet they are searchable, shown as "no offer".
    //
    // Storefront eligibility is explicit: reviewed products plus products whose
    // durable BGG enrichment completed. This preserves the useful enriched
    // catalogue without exposing the ~178k raw discovery rows.
    try {
      const storefrontWhere = {
        OR: [
          { canonicalStatus: 'verified' },
          { bggEnrichment: { is: { status: 'succeeded' } } },
        ],
      };
      const [indexed, eligible] = await Promise.all([
        this.search.documentCount(),
        this.prisma.mktProduct.count({ where: storefrontWhere }),
      ]);
      if (indexed >= 0 && indexed < eligible) {
        this.log.log(`Search index has ${indexed}/${eligible} storefront products — restoring the enriched catalogue`);
        void this.reindexStorefrontCatalog();
      } else if (indexed > 0) {
        void this.reconcileBrowseCategories();
      }
    } catch (error) {
      this.log.warn(`Could not check search index on boot: ${String(error)}`);
    }
  }

  /**
   * Bring every indexed document's `categorySlugs` in line with the database's
   * materialized taxonomy. Needed because category pages filter on that field:
   * documents indexed before it existed, or whose membership changed while the
   * API was down, would otherwise be missing from their own category page.
   *
   * Patches documents in place, so it can never add a product to the storefront
   * index, and no-ops once the index agrees with the database — safe on boot.
   */
  private async reconcileBrowseCategories(): Promise<void> {
    const indexedSlugs = await this.search.allCategorySlugs();
    if (indexedSlugs.size === 0) return;

    const ids = [...indexedSlugs.keys()];
    let patched = 0;
    for (let i = 0; i < ids.length; i += 500) {
      const products = await this.prisma.mktProduct.findMany({
        where: { id: { in: ids.slice(i, i + 500) } },
        select: { id: true, categories: { select: { category: { select: { normalizedName: true } } } } },
      });
      for (const product of products) {
        const expected = product.categories.map((link) => link.category.normalizedName).sort();
        const current = [...(indexedSlugs.get(product.id) ?? [])].sort();
        const same = expected.length === current.length && expected.every((slug, at) => slug === current[at]);
        if (!same && await this.search.updateCategorySlugs(product.id, expected)) patched += 1;
      }
    }
    if (patched > 0) this.log.log(`Browse categories reconciled for ${patched}/${ids.length} indexed products`);
  }

  /**
   * Reindex every storefront-eligible product, offer-less ones included — unlike
   * reindexProducts, which is scoped to active listings for the hourly ranking
   * pass. Repopulates a freshly recreated collection at full search coverage
   * without pulling in the raw BGG discovery pool. Completed enrichment is a
   * durable quality boundary; review status remains independent.
   */
  private async reindexStorefrontCatalog(): Promise<void> {
    const products = await this.prisma.mktProduct.findMany({
      where: {
        OR: [
          { canonicalStatus: 'verified' },
          { bggEnrichment: { is: { status: 'succeeded' } } },
        ],
      },
      select: { id: true },
    });
    let ok = 0;
    for (const { id } of products) {
      try {
        await this.syncProductToSearch(id);
        ok += 1;
      } catch {
        // Non-fatal — the next hourly pass or a manual reindex will catch it.
      }
    }
    this.log.log(`Boot restore of the storefront catalogue complete: ${ok}/${products.length} products`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Trigger an immediate ranking pass (useful for admin / manual trigger). */
  async triggerNow(): Promise<{ jobId: string }> {
    const job = await this.queue.add(JOB_NAME, {}, { priority: 1 });
    return { jobId: job.id ?? 'queued' };
  }

  /** Trigger an immediate, idempotent semantic-index refresh. */
  async triggerSemanticNow(): Promise<{ jobId: string }> {
    const job = await this.queue.add(SEMANTIC_JOB_NAME, {}, { priority: 2 });
    return { jobId: job.id ?? 'queued' };
  }

  // ─── Worker ────────────────────────────────────────────────────────────────

  private async processJob(_job: Job): Promise<void> {
    const startedAt = Date.now();
    let processed = 0;
    let failed = 0;
    let offset = 0;

    while (true) {
      const listings = await this.prisma.listing.findMany({
        where: { active: true },
        skip: offset,
        take: BATCH_SIZE,
        include: {
          seller: {
            select: {
              status: true,
              score: true,
            },
          },
          deliveryOptions: {
            select: { estimatedDaysMin: true, regions: true },
          },
          product: {
            select: {
              id: true,
              listings: {
                where: { active: true },
                select: { priceMinorUnits: true },
              },
            },
          },
        },
      });

      if (listings.length === 0) break;

      for (const listing of listings) {
        try {
          // Compute supporting metrics
          const lowestPrice = Math.min(
            ...listing.product.listings.map((l) => l.priceMinorUnits),
          );

          const bestDelivery = listing.deliveryOptions.reduce(
            (best, d) => (d.estimatedDaysMin < best ? d.estimatedDaysMin : best),
            999,
          );

          const allRegions = listing.deliveryOptions.flatMap((d) => d.regions);
          const coverageScore = allRegions.includes('MX') || allRegions.includes('AR')
            ? 1.0
            : Math.min(allRegions.length / 5, 1.0);

          const syncAgeSeconds = listing.lastSyncedAt
            ? (Date.now() - new Date(listing.lastSyncedAt).getTime()) / 1000
            : 999999;

          const score = listing.seller.score;
          const input: RankingInput = {
            listingId: listing.id,
            sellerId: listing.sellerId,
            productId: listing.productId,
            stock: listing.stock,
            stockStatus: listing.stockStatus,
            stockConfidence: listing.stockConfidence,
            priceMinorUnits: listing.priceMinorUnits,
            lowestPriceForProductMinor: lowestPrice,
            bestDeliveryDays: bestDelivery === 999 ? 7 : bestDelivery,
            listingDeliveryDaysMin: bestDelivery === 999 ? 7 : bestDelivery,
            coverageScore,
            fulfillmentRate: score?.fulfillmentRate ?? 1.0,
            cancellationRate: score?.cancellationRate ?? 0.0,
            customerSvcScore: score?.customerSvcScore ?? 5.0,
            responseTimeHours: score?.responseTimeHours ?? 24.0,
            integrationHealth: score?.integrationHealth ?? 1.0,
            syncAgeSeconds,
            sellerStatus: listing.seller.status,
          };

          const result = calculateRankScore(input);

          await this.prisma.listing.update({
            where: { id: listing.id },
            data: {
              rankScore: result.rankScore,
              scoreBreakdown: result.breakdown,
            },
          });

          processed++;
        } catch (err) {
          this.log.warn(`Failed to rank listing ${listing.id}: ${String(err)}`);
          failed++;
        }
      }

      offset += BATCH_SIZE;
      if (listings.length < BATCH_SIZE) break;
    }

    // After updating all listings, reindex changed products in Typesense
    await this.reindexProducts();

    // The hourly pass only reindexes products WITH an active listing, so an
    // offer-less product whose taxonomy changed (enrichment gave it tags) would
    // keep stale `categorySlugs` until the next API restart. This closes that
    // window; it is a no-op when the index already agrees with the database.
    await this.reconcileBrowseCategories();

    const ms = Date.now() - startedAt;
    this.log.log(`Ranking pass complete: ${processed} ok, ${failed} failed, ${ms}ms`);
  }

  private async processSemanticJob(): Promise<void> {
    if (!this.semantic.isConfigured()) {
      this.log.warn('Semantic refresh skipped: OPENAI_API_KEY is not configured');
      return;
    }
    try {
      const startedAt = Date.now();
      const result = await this.semantic.indexShoppableCatalog();
      this.log.log(
        `Semantic refresh complete: ${result.indexed} indexed, ${result.skipped} unchanged, ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      // Vector freshness must never take down lexical search or ranking jobs.
      this.log.error(`Semantic refresh failed; existing index retained: ${String(error)}`);
    }
  }

  private async reindexProducts(): Promise<void> {
    // Get all products that have at least one active listing
    const products = await this.prisma.mktProduct.findMany({
      where: { listings: { some: { active: true } } },
      select: { id: true },
    });

    for (const { id } of products) {
      try {
        await this.syncProductToSearch(id);
      } catch {
        // Non-fatal — search index will be stale until next pass
      }
    }
  }

  private async syncProductToSearch(productId: string): Promise<void> {
    const product = await this.prisma.mktProduct.findUnique({
      where: { id: productId },
      include: {
        listings: {
          where: { active: true },
          orderBy: { rankScore: 'desc' },
          select: {
            priceMinorUnits: true,
            stock: true,
            stockStatus: true,
          },
        },
        // Browse-category membership, so a category page filters the index
        // rather than dropping to a narrower Prisma query.
        categories: { select: { category: { select: { normalizedName: true } } } },
      },
    });

    if (!product) return;

    const activeListings = product.listings;
    const inStock = activeListings.filter(
      (l) => l.stockStatus !== 'out_of_stock',
    ).length;

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

    await this.search.upsertProduct({
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
      language: product.language ?? '',
      minPlayers: product.minPlayers ?? 0,
      maxPlayers: product.maxPlayers ?? 0,
      minAge: product.minAge ?? 0,
      playTimeMinutes: product.playTimeMinutes ?? 0,
      bggRating: product.bggRating ?? 0,
      bggWeight: product.bggWeight ?? 0,
      minPriceMinor: activeListings.length
        ? Math.min(...activeListings.map((l) => l.priceMinorUnits))
        : 0,
      maxPriceMinor: activeListings.length
        ? Math.max(...activeListings.map((l) => l.priceMinorUnits))
        : 0,
      totalListings: activeListings.length,
      inStockListings: inStock,
      images: product.images,
    });
  }
}
