import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Typesense, { Client } from 'typesense';
import { COMPLEXITY_BAND_RANGES, isComplexityBand } from '../marketplace/complexity-bands.js';

// Shape indexed in Typesense — flat document optimised for search + faceting
export interface ProductDocument {
  id: string;
  slug: string;
  name: string;
  /** Spanish (es-MX) curated title, so Spanish queries match. Falls back to `name`. */
  nameEs?: string;
  publisher: string;
  description: string;
  /** Spanish (es-MX) curated body, so Spanish queries match. Falls back to `description`. */
  descriptionEs?: string;
  category: string;
  tags: string[];
  language: string;
  minPlayers: number;
  maxPlayers: number;
  minAge: number;
  playTimeMinutes: number;
  bggRating: number;
  bggWeight: number;
  // aggregated from listings (updated on every listing change)
  minPriceMinor: number;
  maxPriceMinor: number;
  totalListings: number;
  inStockListings: number;
  images: string[];
}

const COLLECTION = 'mkt_products';

const COLLECTION_SCHEMA = {
  name: COLLECTION,
  fields: [
    { name: 'slug',            type: 'string'  as const },
    { name: 'name',            type: 'string'  as const },
    { name: 'nameEs',          type: 'string'  as const, optional: true },
    { name: 'publisher',       type: 'string'  as const, optional: true },
    { name: 'description',     type: 'string'  as const, optional: true },
    { name: 'descriptionEs',   type: 'string'  as const, optional: true },
    { name: 'category',        type: 'string'  as const, facet: true },
    { name: 'tags',            type: 'string[]' as const, facet: true },
    { name: 'language',        type: 'string'  as const, facet: true, optional: true },
    { name: 'minPlayers',      type: 'int32'   as const, facet: true, optional: true },
    { name: 'maxPlayers',      type: 'int32'   as const, facet: true, optional: true },
    { name: 'minAge',          type: 'int32'   as const, facet: true, optional: true },
    { name: 'playTimeMinutes', type: 'int32'   as const, facet: true, optional: true },
    { name: 'bggRating',       type: 'float'   as const, optional: true, sort: true },
    { name: 'bggWeight',       type: 'float'   as const, optional: true },
    { name: 'minPriceMinor',   type: 'int32'   as const, optional: true, sort: true },
    { name: 'maxPriceMinor',   type: 'int32'   as const, optional: true },
    { name: 'totalListings',   type: 'int32'   as const, optional: false, sort: true },
    { name: 'inStockListings', type: 'int32'   as const, optional: false, sort: true },
    { name: 'images',          type: 'string[]' as const, optional: true },
  ],
  default_sorting_field: 'inStockListings',
};

@Injectable()
export class TypesenseService implements OnModuleInit {
  private readonly log = new Logger(TypesenseService.name);
  private readonly client: Client;

  constructor() {
    this.client = new Typesense.Client({
      nodes: [{
        host: process.env.TYPESENSE_HOST ?? 'localhost',
        port: Number(process.env.TYPESENSE_PORT ?? 8108),
        protocol: 'http',
      }],
      apiKey: process.env.TYPESENSE_API_KEY ?? 'dev-typesense-key',
      connectionTimeoutSeconds: 5,
    });
  }

  async onModuleInit() {
    await this.ensureCollection();
  }

  private async ensureCollection() {
    try {
      const existing = await this.client.collections(COLLECTION).retrieve();
      // Recreate when the schema drifts: wrong sort field, or missing the
      // bilingual search fields (nameEs/descriptionEs). The hourly ranking job
      // repopulates the empty collection; the Prisma fallback covers the gap.
      const fields = (existing as { fields?: Array<{ name: string }> }).fields ?? [];
      const hasBilingual = fields.some((f) => f.name === 'nameEs');
      const sortOk = (existing as { default_sorting_field?: string }).default_sorting_field === 'inStockListings';
      if (!hasBilingual || !sortOk) {
        await this.client.collections(COLLECTION).delete();
        await this.client.collections().create(COLLECTION_SCHEMA);
        this.log.log('Typesense collection recreated (schema updated — bilingual fields)');
      } else {
        this.log.log('Typesense collection ready');
      }
    } catch {
      try {
        await this.client.collections().create(COLLECTION_SCHEMA);
        this.log.log('Typesense collection created');
      } catch (err) {
        // Non-fatal — search degrades to Prisma full-text fallback
        this.log.warn(`Typesense unavailable: ${String(err)}`);
      }
    }
  }

  async upsertProduct(doc: ProductDocument): Promise<void> {
    try {
      await this.client
        .collections(COLLECTION)
        .documents()
        .upsert(doc as unknown as Record<string, unknown>);
    } catch (err) {
      this.log.warn(`Failed to index product ${doc.id}: ${String(err)}`);
    }
  }

  async deleteProduct(id: string): Promise<void> {
    try {
      await this.client.collections(COLLECTION).documents(id).delete();
    } catch {
      // ignore — document may not exist in index
    }
  }

  async search(params: {
    q: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    minPlayers?: number;
    inStockOnly?: boolean;
    mechanics?: string[];
    complexity?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
  }): Promise<{ hits: ProductDocument[]; total: number }> {
    const {
      q, category, minPrice, maxPrice, minPlayers,
      inStockOnly, mechanics, complexity,
      limit = 24, offset = 0, sortBy = 'inStockListings:desc,bggRating:desc',
    } = params;

    // Typesense rejects per_page > 250. Requesting more used to throw and silently
    // drop the caller into the tiny verified-only Prisma fallback (e.g. the sitemap
    // asking for 5000 got just ~26). Clamp so a large request returns a full 250
    // page instead; callers that need everything paginate via offset.
    const perPage = Math.min(Math.max(Math.trunc(limit), 1), 250);

    const filterParts: string[] = [];
    if (category)    filterParts.push(`category:=${category}`);
    if (minPlayers)  filterParts.push(`minPlayers:<=${minPlayers} && maxPlayers:>=${minPlayers}`);
    if (minPrice)    filterParts.push(`minPriceMinor:>=${minPrice}`);
    if (maxPrice)    filterParts.push(`minPriceMinor:<=${maxPrice}`);
    if (inStockOnly) filterParts.push(`inStockListings:>0`);
    if (mechanics && mechanics.length > 0) filterParts.push(`tags:=[${mechanics.join(',')}]`);
    if (complexity && isComplexityBand(complexity)) {
      const { min, max } = COMPLEXITY_BAND_RANGES[complexity];
      filterParts.push(max === null ? `bggWeight:>=${min}` : `bggWeight:>=${min} && bggWeight:<${max}`);
    }

    try {
      const result = await this.client.collections(COLLECTION).documents().search({
        q: q || '*',
        // Match both languages: a Spanish query hits nameEs/descriptionEs, an
        // English one hits name/description. Typesense ORs across query_by fields.
        query_by: 'name,nameEs,publisher,description,descriptionEs,tags',
        query_by_weights: '4,4,2,1,1,2',
        filter_by: filterParts.join(' && ') || undefined,
        sort_by: sortBy,
        per_page: perPage,
        page: Math.floor(offset / perPage) + 1,
        facet_by: 'category,tags,language,minPlayers',
        highlight_full_fields: 'name',
      });

      const hits = (result.hits ?? []).map(
        (h: { document: unknown }) => h.document as ProductDocument,
      );

      return { hits, total: result.found };
    } catch (err) {
      this.log.warn(`Typesense search failed, returning empty: ${String(err)}`);
      return { hits: [], total: 0 };
    }
  }
}
