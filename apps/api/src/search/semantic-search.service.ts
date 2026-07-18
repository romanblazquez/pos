import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import OpenAI from 'openai';

const MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const PRODUCT_ENTITY_TYPE = 'mkt_product';
const LOCALES = ['en', 'es'] as const;
const QUERY_CACHE_LIMIT = 256;
const QUERY_CACHE_TTL_MS = positiveInt(process.env.SEMANTIC_QUERY_CACHE_TTL_MS, 60 * 60 * 1000);

type SemanticHit = { canonicalId: string; score: number };

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);
  private client: OpenAI | null = null;
  private readonly queryCache = new Map<string, { embedding: number[]; expiresAt: number }>();
  private readonly pendingQueries = new Map<string, Promise<number[]>>();
  private vectorSearchAvailable: boolean | undefined;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private getClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
    this.client ??= new OpenAI({ apiKey });
    return this.client;
  }

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  async search(query: string, locale = 'es', limit = 24): Promise<SemanticHit[]> {
    if (!query.trim() || !this.isConfigured()) return [];
    try {
      const embedding = await this.embedQuery(query);
      return this.rank(embedding, locale, limit);
    } catch (error) {
      this.logger.warn(`Semantic query unavailable; using lexical fallback: ${String(error)}`);
      return [];
    }
  }

  async similar(canonicalId: string, locale = 'es', limit = 8): Promise<SemanticHit[]> {
    const source = await this.prisma.searchDocument.findUnique({
      where: { documentType_canonicalId_locale: { documentType: 'PRODUCT', canonicalId, locale: normalizeLocale(locale) } },
      select: { embedding: true },
    });
    if (!source?.embedding.length) return [];
    return this.rank(source.embedding, locale, limit, canonicalId);
  }

  private async rank(vector: number[], locale: string, limit: number, excludeId?: string): Promise<SemanticHit[]> {
    const rawQuery = (this.prisma as unknown as { $queryRawUnsafe?: <T>(sql: string, ...values: unknown[]) => Promise<T> }).$queryRawUnsafe;
    if (rawQuery && vector.length > 0) {
      const capped = Math.min(Math.max(limit, 1), 50);
      const pgArray = `{${vector.join(',')}}`;
      try {
        if (this.vectorSearchAvailable === undefined) {
          const capability = await rawQuery.call(this.prisma,
            `SELECT EXISTS (
               SELECT 1 FROM pg_extension WHERE extname = 'vector'
             ) AND EXISTS (
               SELECT 1 FROM information_schema.columns
               WHERE table_name = 'search_document' AND column_name = 'embedding_vector'
             ) AS available`);
          this.vectorSearchAvailable = Boolean((capability as Array<{ available: boolean }>)[0]?.available);
        }
        const exclusion = excludeId ? `AND "canonicalId" <> $4` : '';
        const sql = this.vectorSearchAvailable
          ? `SELECT "canonicalId", 1 - (embedding_vector <=> $1::vector) AS score
             FROM "search_document"
             WHERE "documentType" = 'PRODUCT' AND locale = $2 AND embedding_vector IS NOT NULL ${exclusion}
             ORDER BY embedding_vector <=> $1::vector LIMIT $3`
          : `SELECT "canonicalId", cosine_similarity_float8(embedding, $1::float8[]) AS score
             FROM "search_document"
             WHERE "documentType" = 'PRODUCT' AND locale = $2 AND cardinality(embedding) > 0 ${exclusion}
             ORDER BY cosine_similarity_float8(embedding, $1::float8[]) DESC NULLS LAST LIMIT $3`;
        const rows = await rawQuery.call(this.prisma, sql, pgArray, normalizeLocale(locale), capped, ...(excludeId ? [excludeId] : [])) as Array<{ canonicalId: string; score: number }>;
        return rows.map((row) => ({ canonicalId: row.canonicalId, score: Number(row.score) }));
      } catch (error) {
        this.logger.warn(`Database vector ranking unavailable; using in-process fallback: ${String(error)}`);
        this.vectorSearchAvailable = false;
      }
    }
    const documents = await this.prisma.searchDocument.findMany({
      where: {
        documentType: 'PRODUCT',
        locale: normalizeLocale(locale),
        embedding: { isEmpty: false },
        ...(excludeId ? { canonicalId: { not: excludeId } } : {}),
      },
      select: { canonicalId: true, embedding: true },
    });
    return documents
      .map((document) => ({ canonicalId: document.canonicalId, score: cosine(vector, document.embedding) }))
      .filter((hit) => Number.isFinite(hit.score))
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.min(Math.max(limit, 1), 50));
  }

  private async embed(input: string): Promise<number[]> {
    const response = await this.getClient().embeddings.create({ model: MODEL, input });
    return response.data[0]?.embedding ?? [];
  }

  private async embedQuery(input: string): Promise<number[]> {
    const key = normalizeQuery(input);
    const cached = this.queryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      // Refresh insertion order so Map also acts as a bounded LRU cache.
      this.queryCache.delete(key);
      this.queryCache.set(key, cached);
      return cached.embedding;
    }
    if (cached) this.queryCache.delete(key);

    const pending = this.pendingQueries.get(key);
    if (pending) return pending;

    const request = this.embed(key)
      .then((embedding) => {
        this.queryCache.set(key, { embedding, expiresAt: Date.now() + QUERY_CACHE_TTL_MS });
        while (this.queryCache.size > QUERY_CACHE_LIMIT) {
          const oldest = this.queryCache.keys().next().value as string | undefined;
          if (!oldest) break;
          this.queryCache.delete(oldest);
        }
        return embedding;
      })
      .finally(() => this.pendingQueries.delete(key));
    this.pendingQueries.set(key, request);
    return request;
  }

  private async embedBatch(inputs: string[]): Promise<number[][]> {
    if (inputs.length === 0) return [];
    const response = await this.getClient().embeddings.create({ model: MODEL, input: inputs });
    return response.data.sort((left, right) => left.index - right.index).map((item) => item.embedding);
  }

  /** Idempotently embeds every verified product with an active listing in EN and ES. */
  async indexShoppableCatalog(): Promise<{ indexed: number; skipped: number }> {
    const products = await this.prisma.mktProduct.findMany({
      where: { canonicalStatus: 'verified', listings: { some: { active: true } } },
      include: {
        listings: { where: { active: true }, select: { priceMinorUnits: true, currency: true, stockStatus: true } },
      },
      orderBy: { id: 'asc' },
    });
    const languages = await this.prisma.language.findMany({ where: { iso6391: { in: [...LOCALES] } } });
    const languageByLocale = new Map(languages.map((language) => [language.iso6391, language.id]));
    const localizations = await this.prisma.entityLocalization.findMany({
      where: {
        entityType: PRODUCT_ENTITY_TYPE,
        entityId: { in: products.map((product) => product.id) },
        languageId: { in: languages.map((language) => language.id) },
        moderationStatus: 'APPROVED',
      },
    });
    const localized = new Map(localizations.map((row) => [`${row.entityId}:${row.languageId}`, row]));
    const existing = await this.prisma.searchDocument.findMany({
      where: { documentType: 'PRODUCT', canonicalId: { in: products.map((product) => product.id) }, locale: { in: [...LOCALES] } },
      select: { canonicalId: true, locale: true, sourceVersion: true, embedding: true },
    });
    const current = new Map(existing.map((row) => [`${row.canonicalId}:${row.locale}`, row]));
    let skipped = 0;
    const pending: Array<{
      product: (typeof products)[number];
      locale: (typeof LOCALES)[number];
      title: string;
      summary: string | null;
      searchableText: string;
      sourceVersion: bigint;
    }> = [];

    for (const product of products) {
      for (const locale of LOCALES) {
        const languageId = languageByLocale.get(locale);
        const copy = languageId ? localized.get(`${product.id}:${languageId}`) : undefined;
        // A localization edit must invalidate the vector even when MktProduct itself
        // did not change, so the newest of both records is the source version.
        const sourceVersion = BigInt(Math.max(product.updatedAt.getTime(), copy?.updatedAt.getTime() ?? 0));
        const prior = current.get(`${product.id}:${locale}`);
        if (prior?.sourceVersion === sourceVersion && prior.embedding.length > 0) {
          skipped += 1;
          continue;
        }
        const title = copy?.title || product.name;
        const summary = copy?.description || product.description;
        const searchableText = buildSearchableText(product, title, summary);
        pending.push({ product, locale, title, summary, searchableText, sourceVersion });
      }
    }

    let indexed = 0;
    // Batching cuts a full 154-document backfill from 154 network round trips to
    // four while staying comfortably below the embeddings endpoint input limit.
    for (let offset = 0; offset < pending.length; offset += 50) {
      const batch = pending.slice(offset, offset + 50);
      const embeddings = await this.embedBatch(batch.map((item) => item.searchableText));
      if (embeddings.length !== batch.length) throw new Error('Embedding response count mismatch');

      for (let index = 0; index < batch.length; index += 1) {
        const { product, locale, title, summary, searchableText, sourceVersion } = batch[index];
        const embedding = embeddings[index];
        const prices = product.listings.map((listing) => listing.priceMinorUnits);
        const currencies = [...new Set(product.listings.map((listing) => listing.currency))];

        await this.prisma.searchDocument.upsert({
          where: { documentType_canonicalId_locale: { documentType: 'PRODUCT', canonicalId: product.id, locale } },
          create: {
            documentType: 'PRODUCT', canonicalId: product.id, entityType: PRODUCT_ENTITY_TYPE, locale,
            title, alternateTitles: [], normalizedTitle: normalize(title), slug: product.slug,
            localizedSlugs: { [locale]: product.slug }, summary, imageUrl: product.images[0],
            minPriceMinor: prices.length ? BigInt(Math.min(...prices)) : null,
            maxPriceMinor: prices.length ? BigInt(Math.max(...prices)) : null,
            countriesAvailable: [], currenciesAvailable: currencies,
            availabilityScore: product.listings.some((listing) => listing.stockStatus !== 'out_of_stock') ? 1 : 0,
            structuredFacets: facets(product), searchableText, embedding, sourceVersion, lastIndexedAt: new Date(),
          },
          update: {
            title, normalizedTitle: normalize(title), summary, imageUrl: product.images[0],
            minPriceMinor: prices.length ? BigInt(Math.min(...prices)) : null,
            maxPriceMinor: prices.length ? BigInt(Math.max(...prices)) : null,
            currenciesAvailable: currencies,
            availabilityScore: product.listings.some((listing) => listing.stockStatus !== 'out_of_stock') ? 1 : 0,
            structuredFacets: facets(product), searchableText, embedding, sourceVersion, lastIndexedAt: new Date(),
          },
        });
        indexed += 1;
      }
    }
    return { indexed, skipped };
  }
}

function normalizeLocale(locale: string): 'en' | 'es' {
  return locale.toLowerCase().startsWith('en') ? 'en' : 'es';
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLocaleLowerCase().slice(0, 500);
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function buildSearchableText(
  product: { name: string; category: string; tags: string[]; publisher: string | null; designer: string | null; minPlayers: number | null; maxPlayers: number | null; playTimeMinutes: number | null; bggWeight: number | null },
  title: string,
  summary: string | null,
): string {
  return [
    title, summary, product.category, product.tags.join(', '), product.publisher, product.designer,
    product.minPlayers && product.maxPlayers ? `${product.minPlayers}-${product.maxPlayers} players jugadores` : null,
    product.playTimeMinutes ? `${product.playTimeMinutes} minutes minutos` : null,
    product.bggWeight ? `complexity weight ${product.bggWeight}` : null,
  ].filter(Boolean).join('\n');
}

function facets(product: { category: string; tags: string[]; minPlayers: number | null; maxPlayers: number | null; playTimeMinutes: number | null; bggWeight: number | null }) {
  return { category: product.category, mechanics: product.tags, minPlayers: product.minPlayers, maxPlayers: product.maxPlayers, playTimeMinutes: product.playTimeMinutes, complexity: product.bggWeight };
}

export function cosine(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return Number.NEGATIVE_INFINITY;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator ? dot / denominator : Number.NEGATIVE_INFINITY;
}
