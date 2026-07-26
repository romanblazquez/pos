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
  /**
   * Normalized browse-category slugs from the materialized taxonomy
   * (mkt_product_category → category.normalizedName), e.g. ['strategy','euro'].
   * Indexed so a category page filters the SAME set the storefront searches
   * instead of falling back to a Prisma query with narrower visibility rules.
   */
  categorySlugs?: string[];
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
  /**
   * ISO code the price range is denominated in, or '' when the product has no
   * listings or spans several currencies. Never defaulted to a house currency:
   * a range labelled with the wrong currency is worse than no range.
   */
  currency: string;
  /** Every distinct listing currency — drives the market/currency facet. */
  currencies: string[];
  totalListings: number;
  inStockListings: number;
  images: string[];
}

const COLLECTION = 'mkt_products';

const COLLECTION_SCHEMA = {
  name: COLLECTION,
  fields: [
    { name: 'slug',            type: 'string'  as const },
    // sort: true is required for `sortBy=name` (name:asc). Without it Typesense
    // rejects the sort, the search returns nothing, and the code falls through
    // to the empty Prisma path — so "Nombre (A–Z)" silently showed 0 results.
    { name: 'name',            type: 'string'  as const, sort: true },
    { name: 'nameEs',          type: 'string'  as const, optional: true },
    { name: 'publisher',       type: 'string'  as const, optional: true },
    { name: 'description',     type: 'string'  as const, optional: true },
    { name: 'descriptionEs',   type: 'string'  as const, optional: true },
    { name: 'category',        type: 'string'  as const, facet: true },
    { name: 'categorySlugs',   type: 'string[]' as const, facet: true, optional: true },
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
    { name: 'currency',        type: 'string'  as const, facet: true, optional: true },
    { name: 'currencies',      type: 'string[]' as const, facet: true, optional: true },
    { name: 'totalListings',   type: 'int32'   as const, optional: false, sort: true },
    { name: 'inStockListings', type: 'int32'   as const, optional: false, sort: true },
    { name: 'images',          type: 'string[]' as const, optional: true },
  ],
  default_sorting_field: 'inStockListings',
};

type ExistingCollectionShape = {
  fields?: Array<{ name: string; sort?: boolean }>;
  default_sorting_field?: string;
  num_documents?: number;
};

/** Cardinality is intentionally absent: catalogue growth is not schema drift. */
export function collectionNeedsRecreation(existing: ExistingCollectionShape): boolean {
  const fields = existing.fields ?? [];
  return !fields.some((field) => field.name === 'nameEs')
    || existing.default_sorting_field !== 'inStockListings'
    || !fields.some((field) => field.name === 'name' && field.sort === true)
    // Without `currency` every price renders in the house currency regardless of
    // what the seller charges, so an index lacking it must be rebuilt, not used.
    || !fields.some((field) => field.name === 'currency');
}

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
      const shape = existing as ExistingCollectionShape;
      const fields = shape.fields ?? [];
      // Collection cardinality is never evidence of corruption. The enriched
      // catalogue grows continuously and previously crossed a hard-coded 5,000
      // document ceiling: startup deleted 7,135 valid documents and rebuilt only
      // the reviewed subset. Eligibility belongs in the database reindex query,
      // not in a destructive Typesense size heuristic.
      if (collectionNeedsRecreation(shape)) {
        await this.client.collections(COLLECTION).delete();
        await this.client.collections().create(COLLECTION_SCHEMA);
        this.log.log('Typesense collection recreated (schema updated)');
        return;
      }
      // An added optional field is applied in place — recreating for it would
      // drop every indexed product the boot reindex does not cover (it reindexes
      // the verified catalogue only), silently shrinking the storefront. Existing
      // docs simply carry no slugs until their next sync; the ranking scheduler's
      // `reconcileBrowseCategories` pass backfills them.
      if (!fields.some((f) => f.name === 'categorySlugs')) {
        await this.client.collections(COLLECTION).update({
          fields: [{ name: 'categorySlugs', type: 'string[]', facet: true, optional: true }],
        } as never);
        this.log.log('Typesense collection extended with categorySlugs');
        return;
      }
      this.log.log('Typesense collection ready');
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

  /**
   * How many documents the collection holds. The scheduler compares this to the
   * catalogue size on boot: a short index (freshly recreated, or repopulated by
   * the active-listing-only hourly job after a wipe) triggers a full reindex.
   * Returns -1 when Typesense is unreachable, so a transient outage never looks
   * like a short index and never triggers a needless full reindex.
   */
  async documentCount(): Promise<number> {
    try {
      const c = await this.client.collections(COLLECTION).retrieve();
      return (c as { num_documents?: number }).num_documents ?? 0;
    } catch {
      return -1;
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

  /**
   * How many indexed products each category holds — browse-taxonomy slugs and
   * raw product types alike, keyed by the value a `category` filter accepts.
   * Taken from the index so a category's advertised count matches what its page
   * actually lists. Empty when Typesense is unreachable, so callers can fall
   * back to counting in the database.
   */
  async categoryCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    try {
      const result = await this.client.collections(COLLECTION).documents().search({
        q: '*',
        query_by: 'name',
        per_page: 1,
        facet_by: 'category,categorySlugs',
        // Default is 10 — far short of the browse taxonomy.
        max_facet_values: 200,
      });
      for (const facet of result.facet_counts ?? []) {
        for (const value of facet.counts ?? []) counts.set(value.value, value.count);
      }
    } catch (err) {
      this.log.warn(`Could not read category counts: ${String(err)}`);
    }
    return counts;
  }

  /**
   * Every indexed document's browse-category slugs, keyed by product id (a
   * document that predates the field maps to an empty array). Lets a caller
   * reconcile the index against the database's taxonomy without re-reading the
   * whole catalogue. Empty when Typesense is unreachable.
   */
  async allCategorySlugs(): Promise<Map<string, string[]>> {
    const slugsById = new Map<string, string[]>();
    const perPage = 250;
    try {
      for (let page = 1; ; page += 1) {
        const result = await this.client.collections(COLLECTION).documents().search({
          q: '*',
          include_fields: 'id,categorySlugs',
          per_page: perPage,
          page,
        });
        const hits = result.hits ?? [];
        for (const hit of hits) {
          const doc = hit.document as { id: string; categorySlugs?: string[] };
          slugsById.set(doc.id, doc.categorySlugs ?? []);
        }
        if (hits.length < perPage) break;
      }
    } catch (err) {
      this.log.warn(`Could not read indexed categories: ${String(err)}`);
    }
    return slugsById;
  }

  /**
   * Patch one field on a document that is ALREADY indexed. Unlike an upsert this
   * cannot add a product to the storefront index (Typesense 404s on a missing
   * document), which is exactly what a backfill wants: refresh what is there,
   * never widen what is searchable.
   */
  async updateCategorySlugs(id: string, categorySlugs: string[]): Promise<boolean> {
    try {
      await this.client.collections(COLLECTION).documents(id).update({ categorySlugs });
      return true;
    } catch {
      return false;
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
    /** Show only products with at least one offer in these currencies. */
    currencies?: string[];
    limit?: number;
    offset?: number;
    sortBy?: string;
  }): Promise<{ hits: ProductDocument[]; total: number }> {
    const {
      q, category, minPrice, maxPrice, minPlayers,
      inStockOnly, mechanics, complexity, currencies,
      limit = 24, offset = 0, sortBy = 'inStockListings:desc,bggRating:desc',
    } = params;

    // Typesense rejects per_page > 250. Requesting more used to throw and silently
    // drop the caller into the tiny verified-only Prisma fallback (e.g. the sitemap
    // asking for 5000 got just ~26). Clamp so a large request returns a full 250
    // page instead; callers that need everything paginate via offset.
    const perPage = Math.min(Math.max(Math.trunc(limit), 1), 250);

    const filterParts: string[] = [];
    // `category` accepts either a browse-taxonomy slug ('strategy', 'two-player')
    // or the raw product type ('board-game', 'expansion'), because both back a
    // real category URL. Values can contain spaces/dashes, so backtick-quote them.
    if (category)    filterParts.push(`(category:=\`${category}\` || categorySlugs:=\`${category}\`)`);
    if (minPlayers)  filterParts.push(`minPlayers:<=${minPlayers} && maxPlayers:>=${minPlayers}`);
    if (minPrice)    filterParts.push(`minPriceMinor:>=${minPrice}`);
    if (maxPrice)    filterParts.push(`minPriceMinor:<=${maxPrice}`);
    if (inStockOnly) filterParts.push(`inStockListings:>0`);
    // Currency is a FILTER, not a converter: it selects which sellers' offers a
    // shopper is willing to see, priced as those sellers actually quote them.
    // Nothing is converted, so no landed cost is implied and none is invented.
    if (currencies && currencies.length > 0) {
      filterParts.push(`currencies:=[${currencies.map((c) => `\`${c}\``).join(',')}]`);
    }
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
        facet_by: 'category,categorySlugs,tags,language,minPlayers',
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
