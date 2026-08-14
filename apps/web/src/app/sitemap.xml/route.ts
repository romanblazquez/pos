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

// Custom XML sitemap (spec §7). Next 14.2's MetadataRoute.Sitemap silently drops
// the `images` field, so we emit the XML directly to include <image:image> — the
// product images are self-hosted now, so we want them eligible for Google Images.
// Includes ONLY canonical, indexable URLs (iterates INDEXABLE_LOCALES; never emits
// noindex/search/account/paginated pages).
//
// `dynamic = 'force-dynamic'`, not `revalidate`: this fetches the full indexable
// catalogue (tens of thousands of products, paged) plus every taxonomy vocabulary,
// which `next build` was attempting to pre-render as a static route. That routinely
// brushed the 60s static-worker timeout, then tipped over into a hard build
// failure once one more fetch (getSellers) was added. The manual Cache-Control
// header below already gives this the same "fresh, then cached" behaviour a
// finite `revalidate` would — the build just never needs to run it.
export const dynamic = 'force-dynamic';

// The catalog API is Typesense-backed (per_page cap 250), so page through in
// 250s up to `total`.
//
// MAX_PAGES was 50 — 12,500 products — set when the enriched catalogue was
// ~2,200 and the cap was comfortably out of reach. Enrichment has since passed
// 21,000, so the cap was silently withholding 43% of the indexable catalogue
// from Google: pages that render, self-canonicalise and say `index, follow`,
// but that nothing tells a crawler exist.
//
// The ceiling now is the protocol's own: 50,000 URLs and 50MB per sitemap. That
// is a per-URL budget shared by every indexable language x market pair, so the
// guard below counts entries rather than products.
const PAGE_SIZE = 250;
const MAX_PAGES = 200;
/** Sitemap protocol hard limits. Exceeding either makes Google reject the file. */
const MAX_URLS_PER_SITEMAP = 50_000;
/** Concurrent upstream page fetches — enough to be quick, few enough to be kind. */
const FETCH_CONCURRENCY = 8;

interface UrlEntry {
  loc: string;
  changefreq: string;
  priority: number;
  image?: string;
}

async function allIndexableProducts(): Promise<ProductSummary[]> {
  const first = await listProducts({ limit: PAGE_SIZE, offset: 0 });
  const products = [...first.results];
  const pages = Math.min(Math.ceil(first.total / PAGE_SIZE), MAX_PAGES);

  // Fetched in bounded batches rather than one Promise.all over every page: at
  // 21k products that would open ~87 simultaneous connections to Typesense on
  // the same small box that serves the site.
  for (let start = 1; start < pages; start += FETCH_CONCURRENCY) {
    const batch = await Promise.all(
      Array.from(
        { length: Math.min(FETCH_CONCURRENCY, pages - start) },
        (_, i) => listProducts({ limit: PAGE_SIZE, offset: (start + i) * PAGE_SIZE }),
      ),
    );
    for (const page of batch) products.push(...page.results);
  }
  return products;
}

function xmlEscape(value: string): string {
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

export async function GET(): Promise<Response> {
  const products = await allIndexableProducts();
  // Market-independent taxonomy vocabularies — fetched once, emitted per
  // market×locale below, same as `products`.
  const [publishers, mechanics, stores] = await Promise.all([getCatalogFacets(), getMechanics(), getSellers()]);

  const entries: UrlEntry[] = [];

  // Every indexable language x indexable market pair is its own URL space.
  for (const market of INDEXABLE_MARKETS)
  for (const locale of INDEXABLE_LOCALES) {
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
      entries.push({
        loc: `${SITE_URL}${entityPath('publishers', locale, slugify(p.value), market)}`,
        changefreq: 'weekly',
        priority: 0.6,
      });
    }
    for (const m of mechanics) {
      entries.push({
        loc: `${SITE_URL}${entityPath('mechanics', locale, slugify(m.mechanic), market)}`,
        changefreq: 'weekly',
        priority: 0.6,
      });
    }
    for (const s of stores) {
      entries.push({
        loc: `${SITE_URL}${entityPath('stores', locale, s.slug, market)}`,
        changefreq: 'daily',
        priority: 0.6,
      });
    }

    for (const p of products) {
      entries.push({
        loc: `${SITE_URL}${entityPath('games', locale, p.slug, market)}`,
        changefreq: 'daily',
        priority: 0.8,
        image: p.images?.[0],
      });
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

  // A sitemap over the limit is rejected wholesale, which is worse than a
  // truncated one: losing the tail beats losing the file. When this trips, the
  // fix is a sitemap index, not a bigger number here.
  const capped = entries.slice(0, MAX_URLS_PER_SITEMAP);

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">` +
    capped.map(renderUrl).join('') +
    `</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
