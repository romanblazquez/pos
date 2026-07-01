import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient, type MktProduct } from '@prisma/client';
import translate from 'google-translate-api-x';
import type { EnricherConfig } from './config.js';

const PRODUCT_ENTITY_TYPE = 'mkt_product';
const MAX_TRANSLATION_TEXT_LENGTH = 4500;

interface ScrapedGame {
  bgg_id: number;
  name: string;
  description: string;
  year_published: number | null;
  min_players: number | null;
  max_players: number | null;
  min_age: number | null;
  play_time_minutes: number | null;
  image_url: string | null;
  source_image_url?: string | null;
  image_downloaded?: boolean;
  image_error?: string | null;
  rating: number | null;
  weight: number | null;
  designer: string | null;
  publisher: string | null;
  categories: string[];
  mechanics: string[];
}

interface TranslationDraft {
  title: string;
  description: string | null;
}

export interface RuntimeStatus {
  state: 'starting' | 'running' | 'waiting' | 'complete' | 'circuit_open' | 'stopping';
  batch: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  currentBggId?: string;
  message?: string;
  updatedAt: string;
}

interface CircuitRecord {
  openedAt: string;
  reason: string;
  service: 'bgg' | 'google-translate' | 'worker';
}

class RemoteError extends Error {
  constructor(
    message: string,
    readonly service: 'bgg' | 'google-translate',
    readonly permanent = false,
    readonly immediateCircuit = false,
  ) {
    super(message);
  }
}

class CircuitOpenError extends Error {
  constructor(readonly record: CircuitRecord) {
    super(record.reason);
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      signal.removeEventListener('abort', done);
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/<[^>]+>/g, '')
    .trim()
    .slice(0, MAX_TRANSLATION_TEXT_LENGTH);
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2000);
}

export class BggEnrichmentWorker {
  readonly status: RuntimeStatus = {
    state: 'starting', batch: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0,
    updatedAt: new Date().toISOString(),
  };

  private readonly prisma = new PrismaClient();
  private readonly circuitPath: string;
  private readonly statusPath: string;
  private lastTranslationAt = 0;
  private consecutiveFailures = 0;
  private targetLanguageId: string | null = null;

  constructor(private readonly config: EnricherConfig, private readonly signal: AbortSignal) {
    this.circuitPath = join(config.stateDir, 'circuit-open.json');
    this.statusPath = join(config.stateDir, 'status.json');
  }

  async initialize(): Promise<CircuitRecord | null> {
    await mkdir(this.config.stateDir, { recursive: true });
    if (this.config.resetCircuit) await rm(this.circuitPath, { force: true });

    const existingCircuit = await this.readCircuit();
    if (existingCircuit) {
      await this.setStatus('circuit_open', existingCircuit.reason);
      return existingCircuit;
    }

    await this.prisma.$connect();
    await this.recoverStaleWork();

    if (this.config.translateEnabled) {
      const language = await this.prisma.language.findUnique({
        where: { code: this.config.translateTargetLocale },
        select: { id: true },
      });
      if (!language) {
        throw new Error(
          `Translation target Language ${this.config.translateTargetLocale} is missing; run Prisma migrations/reference seed first`,
        );
      }
      this.targetLanguageId = language.id;
    }

    await this.setStatus('running', 'Worker initialized');
    return null;
  }

  async run(): Promise<void> {
    while (!this.signal.aborted) {
      const products = await this.loadBatch();
      if (products.length === 0) {
        const unfinished = await this.prisma.bggEnrichmentState.count({
          where: { status: { in: ['pending', 'running', 'retry'] } },
        });
        const message = unfinished > 0
          ? `${unfinished} products are waiting for retry; polling again later`
          : 'All currently known BGG products are enriched';
        await this.setStatus(unfinished > 0 ? 'waiting' : 'complete', message);
        await sleep(this.config.emptyPollMs, this.signal);
        continue;
      }

      this.status.batch += 1;
      await this.setStatus('running', `Processing batch ${this.status.batch} (${products.length} products)`);

      for (const product of products) {
        if (this.signal.aborted) break;
        await this.claimProduct(product);
        this.status.currentBggId = product.bggId ?? undefined;
        await this.persistStatus();
        try {
          await this.enrichProduct(product);
          this.consecutiveFailures = 0;
          this.status.succeeded += 1;
        } catch (error) {
          if (error instanceof CircuitOpenError) throw error;
          await this.recordFailure(product, error);
          if (error instanceof RemoteError && !error.permanent) {
            this.consecutiveFailures += 1;
            if (error.immediateCircuit || this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
              throw new CircuitOpenError({
                openedAt: new Date().toISOString(),
                reason: error.immediateCircuit
                  ? error.message
                  : `${error.service} failed ${this.consecutiveFailures} consecutive times; last error: ${error.message}`,
                service: error.service,
              });
            }
          }
        } finally {
          this.status.processed += 1;
          delete this.status.currentBggId;
          await this.persistStatus();
        }
        await sleep(this.config.itemDelayMs, this.signal);
      }

      if (!this.signal.aborted) {
        const waitMs = randomBetween(this.config.batchDelayMinMs, this.config.batchDelayMaxMs);
        await this.setStatus('waiting', `Batch complete; next batch in ${Math.round(waitMs / 1000)} seconds`);
        await sleep(waitMs, this.signal);
      }
    }
  }

  async openCircuit(record: CircuitRecord): Promise<void> {
    await this.writeJsonAtomic(this.circuitPath, record);
    await this.setStatus('circuit_open', record.reason);
  }

  async close(): Promise<void> {
    await this.setStatus('stopping', 'Worker stopping');
    await this.prisma.$disconnect().catch(() => undefined);
  }

  private async loadBatch(): Promise<MktProduct[]> {
    const now = new Date();
    return this.prisma.mktProduct.findMany({
      where: {
        bggId: { not: null },
        OR: [
          { bggEnrichment: { is: null } },
          {
            bggEnrichment: {
              is: {
                status: 'retry',
                OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
              },
            },
          },
        ],
      },
      orderBy: [{ bggRank: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: this.config.batchSize,
    });
  }

  private async claimProduct(product: MktProduct): Promise<void> {
    if (!product.bggId) return;
    await this.prisma.bggEnrichmentState.upsert({
      where: { productId: product.id },
      create: { productId: product.id, bggId: product.bggId, status: 'running', attempts: 1 },
      update: {
        status: 'running',
        attempts: { increment: 1 },
        lastError: null,
        nextRetryAt: null,
        completedAt: null,
      },
    });
  }

  private async enrichProduct(product: MktProduct): Promise<void> {
    if (!product.bggId) return;
    const game = await this.fetchGame(product.bggId);
    const description = cleanDescription(game.description ?? '');

    if (game.source_image_url && (!game.image_url || game.image_error)) {
      throw new RemoteError(
        `BGG ${product.bggId} image could not be stored locally: ${game.image_error ?? 'no local URL returned'}`,
        'bgg',
      );
    }

    const translation = await this.translateIfNeeded(product.id, game.name, description);
    const now = new Date();
    const tags = [...new Set([...(game.categories ?? []), ...(game.mechanics ?? [])])].slice(0, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.mktProduct.update({
        where: { id: product.id },
        data: {
          name: game.name,
          description: description || undefined,
          publisher: game.publisher ?? undefined,
          designer: game.designer ?? undefined,
          yearPublished: game.year_published ?? undefined,
          minPlayers: game.min_players ?? undefined,
          maxPlayers: game.max_players ?? undefined,
          minAge: game.min_age ?? undefined,
          playTimeMinutes: game.play_time_minutes ?? undefined,
          bggRating: game.rating ?? undefined,
          bggWeight: game.weight ?? undefined,
          images: game.image_url ? [game.image_url] : product.images,
          tags: tags.length > 0 ? tags : product.tags,
        },
      });

      if (translation && this.targetLanguageId) {
        const existing = await tx.entityLocalization.findUnique({
          where: {
            entityType_entityId_languageId: {
              entityType: PRODUCT_ENTITY_TYPE,
              entityId: product.id,
              languageId: this.targetLanguageId,
            },
          },
        });
        // Never overwrite a human-approved localization with machine output.
        if (!existing || existing.moderationStatus !== 'APPROVED') {
          await tx.entityLocalization.upsert({
            where: {
              entityType_entityId_languageId: {
                entityType: PRODUCT_ENTITY_TYPE,
                entityId: product.id,
                languageId: this.targetLanguageId,
              },
            },
            create: {
              entityType: PRODUCT_ENTITY_TYPE,
              entityId: product.id,
              languageId: this.targetLanguageId,
              title: translation.title,
              normalizedTitle: translation.title.toLocaleLowerCase(this.config.translateTargetLocale),
              description: translation.description,
              localizationNotes: 'Machine translated with google-translate-api-x; review before publication.',
              moderationStatus: this.config.translationModerationStatus,
            },
            update: {
              title: translation.title,
              normalizedTitle: translation.title.toLocaleLowerCase(this.config.translateTargetLocale),
              description: translation.description,
              localizationNotes: 'Machine translated with google-translate-api-x; review before publication.',
              moderationStatus: this.config.translationModerationStatus,
              reviewedBy: null,
              reviewedAt: null,
            },
          });
        }
      }

      await tx.bggEnrichmentState.update({
        where: { productId: product.id },
        data: {
          status: 'succeeded',
          lastError: null,
          nextRetryAt: null,
          scrapedAt: now,
          imageDownloadedAt: game.image_downloaded ? now : undefined,
          translatedAt: translation ? now : undefined,
          completedAt: now,
        },
      });
    });

    await this.syncSearchIndex(product.id);
    console.log(`[bgg-enricher] enriched BGG ${product.bggId}: ${game.name}`);
  }

  private async fetchGame(bggId: string): Promise<ScrapedGame> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.config.scraperUrl}/game/${encodeURIComponent(bggId)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (error) {
      throw new RemoteError(`BGG scraper request failed: ${errorMessage(error)}`, 'bgg');
    } finally {
      clearTimeout(timer);
    }

    const body = await response.text();
    if (!response.ok) {
      const rejected = [401, 403, 429].includes(response.status)
        || /cloudflare|captcha|challenge|forbidden|rate.?limit|rejected/i.test(body);
      throw new RemoteError(
        `BGG scraper returned HTTP ${response.status}: ${body.slice(0, 500)}`,
        'bgg',
        response.status === 404,
        rejected,
      );
    }

    let payload: { game?: ScrapedGame };
    try {
      payload = JSON.parse(body) as { game?: ScrapedGame };
    } catch {
      throw new RemoteError('BGG scraper returned non-JSON content', 'bgg');
    }
    const game = payload.game;
    if (!game || String(game.bgg_id) !== bggId || !game.name?.trim()) {
      throw new RemoteError(`BGG scraper returned an invalid/mismatched game payload for ${bggId}`, 'bgg');
    }
    return game;
  }

  private async translateIfNeeded(
    productId: string,
    title: string,
    description: string,
  ): Promise<TranslationDraft | null> {
    if (!this.config.translateEnabled || !this.targetLanguageId) return null;

    const existing = await this.prisma.entityLocalization.findUnique({
      where: {
        entityType_entityId_languageId: {
          entityType: PRODUCT_ENTITY_TYPE,
          entityId: productId,
          languageId: this.targetLanguageId,
        },
      },
      select: { title: true, description: true },
    });
    if (existing) return { title: existing.title, description: existing.description };

    const elapsed = Date.now() - this.lastTranslationAt;
    const requiredDelay = this.config.translateMinDelayMs
      + randomBetween(0, this.config.translateJitterMs);
    if (elapsed < requiredDelay) await sleep(requiredDelay - elapsed, this.signal);

    try {
      const input = {
        title: title.slice(0, MAX_TRANSLATION_TEXT_LENGTH),
        ...(description ? { description: description.slice(0, MAX_TRANSLATION_TEXT_LENGTH) } : {}),
      };
      const result = await translate(input, {
        from: 'auto',
        to: this.config.translateTargetIso,
        forceBatch: true,
        fallbackBatch: true,
        rejectOnPartialFail: true,
      });
      this.lastTranslationAt = Date.now();
      const translatedTitle = result.title?.text?.trim();
      if (!translatedTitle) throw new Error('empty translated title');
      return {
        title: translatedTitle,
        description: result.description?.text?.trim() || null,
      };
    } catch (error) {
      this.lastTranslationAt = Date.now();
      const message = errorMessage(error);
      const rejected = /\b(403|429|503)\b|forbidden|rate.?limit|too many requests/i.test(message);
      throw new RemoteError(`Google Translate request failed: ${message}`, 'google-translate', false, rejected);
    }
  }

  private async recordFailure(product: MktProduct, error: unknown): Promise<void> {
    const message = errorMessage(error);
    const state = await this.prisma.bggEnrichmentState.findUnique({ where: { productId: product.id } });
    const permanent = error instanceof RemoteError && error.permanent;
    const exhausted = (state?.attempts ?? 1) >= this.config.maxProductAttempts;
    const status = permanent ? 'skipped' : exhausted ? 'failed' : 'retry';
    const complete = status !== 'retry';
    await this.prisma.bggEnrichmentState.update({
      where: { productId: product.id },
      data: {
        status,
        lastError: message,
        nextRetryAt: complete ? null : new Date(Date.now() + this.config.retryDelayMs),
        completedAt: complete ? new Date() : null,
      },
    });
    if (permanent) this.status.skipped += 1;
    else this.status.failed += 1;
    console.error(`[bgg-enricher] BGG ${product.bggId} ${status}: ${message}`);
  }

  private async recoverStaleWork(): Promise<void> {
    const staleBefore = new Date(Date.now() - this.config.staleRunningMs);
    const recovered = await this.prisma.bggEnrichmentState.updateMany({
      where: { status: 'running', updatedAt: { lt: staleBefore } },
      data: {
        status: 'retry',
        nextRetryAt: new Date(),
        lastError: 'Recovered after worker stopped before completing this product',
      },
    });
    if (recovered.count > 0) console.warn(`[bgg-enricher] recovered ${recovered.count} stale products`);
  }

  private async syncSearchIndex(productId: string): Promise<void> {
    if (!this.config.typesenseUrl || !this.config.typesenseApiKey) return;
    const product = await this.prisma.mktProduct.findUnique({
      where: { id: productId },
      include: {
        listings: {
          where: { active: true },
          select: { priceMinorUnits: true, stockStatus: true },
        },
      },
    });
    if (!product) return;
    const prices = product.listings.map((listing) => listing.priceMinorUnits);
    const document = {
      id: product.id,
      slug: product.slug,
      name: product.name,
      publisher: product.publisher ?? '',
      description: product.description ?? '',
      category: product.category,
      tags: product.tags,
      language: product.language ?? '',
      minPlayers: product.minPlayers ?? 0,
      maxPlayers: product.maxPlayers ?? 0,
      minAge: product.minAge ?? 0,
      playTimeMinutes: product.playTimeMinutes ?? 0,
      bggRating: product.bggRating ?? 0,
      bggWeight: product.bggWeight ?? 0,
      minPriceMinor: prices.length ? Math.min(...prices) : 0,
      maxPriceMinor: prices.length ? Math.max(...prices) : 0,
      totalListings: product.listings.length,
      inStockListings: product.listings.filter((listing) => listing.stockStatus !== 'out_of_stock').length,
      images: product.images,
    };
    try {
      const response = await fetch(
        `${this.config.typesenseUrl}/collections/mkt_products/documents?action=upsert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-TYPESENSE-API-KEY': this.config.typesenseApiKey },
          body: JSON.stringify(document),
        },
      );
      if (!response.ok) console.warn(`[bgg-enricher] Typesense sync returned ${response.status}`);
    } catch (error) {
      console.warn(`[bgg-enricher] Typesense sync skipped: ${errorMessage(error)}`);
    }
  }

  private async readCircuit(): Promise<CircuitRecord | null> {
    try {
      return JSON.parse(await readFile(this.circuitPath, 'utf8')) as CircuitRecord;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return null;
      throw error;
    }
  }

  private async setStatus(state: RuntimeStatus['state'], message: string): Promise<void> {
    this.status.state = state;
    this.status.message = message;
    await this.persistStatus();
    console.log(`[bgg-enricher] ${state}: ${message}`);
  }

  private async persistStatus(): Promise<void> {
    this.status.updatedAt = new Date().toISOString();
    await this.writeJsonAtomic(this.statusPath, this.status);
  }

  private async writeJsonAtomic(path: string, value: unknown): Promise<void> {
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
  }
}

export function isCircuitOpenError(error: unknown): error is CircuitOpenError {
  return error instanceof CircuitOpenError;
}
