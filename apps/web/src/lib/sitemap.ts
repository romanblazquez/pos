// Shared sitemap machinery for the index at /sitemap.xml and the chunk files
// it points at (/sitemaps/*.xml).
//
// Why an index rather than one file: the sitemap protocol caps a single file
// at 50,000 URLs, and the indexable catalogue passed 155,000 products. A
// single file therefore CANNOT carry the catalogue — it is not a tuning
// problem, and raising a constant cannot fix it. Google reads an index and
// fetches each child, so the catalogue is split into stable chunks.
import { getCatalogFacets, getMechanics, getSellers, listProducts, type ProductSummary } from '@/lib/api';
import { editorPath, listEditorialAuthors, listGuides } from '@/lib/guides';
import { INDEXABLE_THEMES } from '@/lib/themes';
import { SITE_URL } from '@/lib/site';
import {
  INDEXABLE_LOCALES,
  INDEXABLE_MARKETS,
  entityPath,
  homePath,
  listingPath,
  slugify,
} from '@/lib/segments';

/** Upstream page size — Typesense caps `per_page` at 250. */
const PAGE_SIZE = 250;
/**
 * Concurrent upstream fetches. Lowered from 8: at 8 the API (same small box)
 * shed enough requests that whole pages came back empty, and `listProducts`
 * turns a failed request into `{ results: [], total: 0 }` — so the loss was
 * silent and the sitemap simply came out short.
 */
const FETCH_CONCURRENCY = 4;

/** Attempts per upstream page before giving up on the whole file. */
const FETCH_ATTEMPTS = 3;

/**
 * Generated sitemaps, memoised in-process.
 *
 * Each product chunk costs ~160 upstream calls covering 40,000 products, and
 * the route is deliberately uncached at the data layer so totals are never
 * stale. Without this, every crawler hit would replay that against the same
 * small box that serves the site — which is how the API degraded into its
 * Postgres fallback mid-build and produced a 750-URL "catalogue". Regenerate
 * at most hourly; only successes are stored, so a failure is retried rather
 * than cached.
 */
const MEMO_TTL_MS = 60 * 60 * 1000;
const memo = new Map<string, { at: number; body: string }>();

export async function memoisedXml(key: string, build: () => Promise<string>): Promise<string> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.body;
  const body = await build();
  memo.set(key, { at: Date.now(), body });
  return body;
}

/**
 * A sitemap must never be *partially* correct.
 *
 * `listProducts` swallows transport failures and returns an empty page, so a
 * dropped request used to shorten the file with no signal at all — and a
 * short or empty sitemap is not a smaller truth, it is an active statement
 * that the missing URLs do not exist. Refusing to serve (and letting the
 * route 503) makes Google retry later, which is the recoverable outcome.
 */
class SitemapIncomplete extends Error {}

async function fetchPage(offset: number, limit: number, total: number): Promise<ProductSummary[]> {
  // How many rows this page MUST return. Anything less is a dropped request,
  // not a short page — `listProducts` reports a transport failure as
  // `{ results: [], total: 0 }`, which is byte-identical to a genuine empty
  // tail, so the count is the only trustworthy signal that the page is whole.
  const expected = Math.max(0, Math.min(limit, total - offset));
  if (expected === 0) return [];

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    const { results, source } = await listProducts({
      limit, offset, sortBy: 'name', fresh: true,
    });
    if (results.length >= expected && source !== 'db') return results;
    if (attempt < FETCH_ATTEMPTS) await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  throw new SitemapIncomplete(
    `Page at offset ${offset} returned fewer than ${expected} rows after ${FETCH_ATTEMPTS} attempts`,
  );
}

/**
 * URLs per child sitemap.
 *
 * The protocol allows 50,000, but the ceiling here is what this hardware can
 * actually serve in one request. Measured on the box: 40 upstream pages
 * (10,000 products) completes in ~7s with zero dropped pages, while 160 pages
 * (40,000) degraded badly enough that the API fell back to Postgres mid-run.
 * An index may reference up to 50,000 child sitemaps, so more, smaller,
 * reliable files beat fewer files that intermittently refuse to build.
 */
export const CHUNK_SIZE = 10_000;

export interface UrlEntry {
  loc: string;
  changefreq: string;
  priority: number;
  image?: string;
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderUrl({ loc, changefreq, priority, image }: UrlEntry): string {
  const imageNode = image
    ? `<image:image><image:loc>${xmlEscape(image)}</image:loc></image:image>`
    : '';
  return `<url><loc>${xmlEscape(loc)}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority>${imageNode}</url>`;
}

export function renderUrlSet(entries: UrlEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`
    + entries.map(renderUrl).join('')
    + `</urlset>`;
}

export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

/** How many market x locale URL spaces the catalogue is emitted into. */
export function marketLocalePairs(): Array<{ market: string; locale: (typeof INDEXABLE_LOCALES)[number] }> {
  const pairs: Array<{ market: string; locale: (typeof INDEXABLE_LOCALES)[number] }> = [];
  for (const market of INDEXABLE_MARKETS) {
    for (const locale of INDEXABLE_LOCALES) pairs.push({ market, locale });
  }
  return pairs;
}

/**
 * Live product count. Read `fresh` on purpose: the number of child sitemaps is
 * derived from it, and a cached total would publish an index that omits whole
 * chunks of the catalogue.
 */
export async function indexableProductCount(): Promise<number> {
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    const { total, source } = await listProducts({ limit: 1, offset: 0, fresh: true });
    // `source: 'db'` means the search index was unreachable and the API answered
    // from Postgres, which only sees verified products with an active listing —
    // a few dozen out of 155,000. Publishing that as the catalogue would delist
    // the site. Treat a degraded search as "cannot build a sitemap".
    if (total > 0 && source !== 'db') return total;
    if (attempt < FETCH_ATTEMPTS) await new Promise((r) => setTimeout(r, 250 * attempt));
  }
  // Zero here means the API is unreachable, not that the catalogue is empty —
  // publishing an index that says so would retract the whole site.
  throw new SitemapIncomplete('Could not read the catalogue size');
}

/**
 * One chunk of the product URL space, in a STABLE order.
 *
 * `sortBy: 'name'` matters: chunk boundaries are offsets, and the default
 * ranking sort reorders as stock and ratings change, so two chunks fetched
 * minutes apart could overlap or skip products. Name order is stable between
 * requests, which is what makes offset-based chunking correct.
 */
export async function productEntriesForChunk(chunk: number): Promise<UrlEntry[]> {
  const pairs = marketLocalePairs();
  const perPair = Math.ceil(CHUNK_SIZE / Math.max(pairs.length, 1));
  const startOffset = chunk * perPair;

  const total = await indexableProductCount();
  if (startOffset >= total) return [];

  const wanted = Math.min(perPair, total - startOffset);
  const pageCount = Math.ceil(wanted / PAGE_SIZE);

  const products: ProductSummary[] = [];
  for (let page = 0; page < pageCount; page += FETCH_CONCURRENCY) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(FETCH_CONCURRENCY, pageCount - page) }, (_, i) =>
        fetchPage(startOffset + (page + i) * PAGE_SIZE, PAGE_SIZE, total),
      ),
    );
    for (const result of batch) products.push(...result);
  }

  const entries: UrlEntry[] = [];
  for (const { market, locale } of pairs) {
    for (const product of products) {
      entries.push({
        loc: `${SITE_URL}${entityPath('games', locale, product.slug, market)}`,
        changefreq: 'daily',
        priority: 0.8,
        image: product.images?.[0],
      });
    }
  }
  return entries;
}

/**
 * Everything that is not a product: hubs, curated themes, the publisher and
 * mechanic vocabularies, seller storefronts, and the market-neutral editorial.
 * Comfortably inside one file.
 */
export async function taxonomyEntries(): Promise<UrlEntry[]> {
  const [publishers, mechanics, stores] = await Promise.all([
    getCatalogFacets(),
    getMechanics(),
    getSellers(),
  ]);

  const entries: UrlEntry[] = [];

  for (const { market, locale } of marketLocalePairs()) {
    entries.push({ loc: `${SITE_URL}${homePath(locale, market)}`, changefreq: 'daily', priority: 1 });
    entries.push({ loc: `${SITE_URL}${listingPath('games', locale, market)}`, changefreq: 'daily', priority: 0.9 });
    entries.push({ loc: `${SITE_URL}${listingPath('categories', locale, market)}`, changefreq: 'weekly', priority: 0.6 });
    entries.push({ loc: `${SITE_URL}${listingPath('publishers', locale, market)}`, changefreq: 'weekly', priority: 0.6 });
    entries.push({ loc: `${SITE_URL}${listingPath('mechanics', locale, market)}`, changefreq: 'weekly', priority: 0.6 });
    entries.push({ loc: `${SITE_URL}${listingPath('stores', locale, market)}`, changefreq: 'weekly', priority: 0.6 });

    // Curated theme landing pages (the real category SEO targets). The catch-all
    // shelf is browsable but noindex, so it never enters the sitemap.
    for (const theme of INDEXABLE_THEMES) {
      entries.push({
        loc: `${SITE_URL}${entityPath('categories', locale, theme.slug[locale], market)}`,
        changefreq: 'weekly',
        priority: 0.7,
      });
    }
    for (const p of publishers.publishers) {
      entries.push({ loc: `${SITE_URL}${entityPath('publishers', locale, slugify(p.value), market)}`, changefreq: 'weekly', priority: 0.6 });
    }
    for (const m of mechanics) {
      entries.push({ loc: `${SITE_URL}${entityPath('mechanics', locale, slugify(m.mechanic), market)}`, changefreq: 'weekly', priority: 0.6 });
    }
    for (const s of stores) {
      entries.push({ loc: `${SITE_URL}${entityPath('stores', locale, s.slug, market)}`, changefreq: 'daily', priority: 0.6 });
    }
  }

  // Editorial is market-neutral: emitted once per indexable LANGUAGE, outside the
  // market loop. Emitting it per market would list the same article several
  // times, which is the duplicate content the language-only URL exists to avoid.
  for (const locale of INDEXABLE_LOCALES) {
    entries.push({ loc: `${SITE_URL}${listingPath('guides', locale)}`, changefreq: 'weekly', priority: 0.7 });
    for (const guide of await listGuides(locale)) {
      entries.push({ loc: `${SITE_URL}${entityPath('guides', locale, guide.slug)}`, changefreq: 'monthly', priority: 0.7 });
    }
    entries.push({ loc: `${SITE_URL}${listingPath('editors', locale)}`, changefreq: 'monthly', priority: 0.5 });
    for (const editor of await listEditorialAuthors()) {
      entries.push({ loc: `${SITE_URL}${editorPath(editor, locale)}`, changefreq: 'monthly', priority: 0.5 });
    }
  }

  return entries;
}
