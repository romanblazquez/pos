import { listProducts, type ProductSummary } from '@/lib/api';
import { editorPath, listEditorialAuthors, listGuides } from '@/lib/guides';
import { INDEXABLE_THEMES } from '@/lib/themes';
import { SITE_URL } from '@/lib/site';
import {
  INDEXABLE_LOCALES,
  INDEXABLE_MARKETS,
  entityPath,
  homePath,
  listingPath,
} from '@/lib/segments';

// Custom XML sitemap (spec §7). Next 14.2's MetadataRoute.Sitemap silently drops
// the `images` field, so we emit the XML directly to include <image:image> — the
// product images are self-hosted now, so we want them eligible for Google Images.
// Includes ONLY canonical, indexable URLs (iterates INDEXABLE_LOCALES; never emits
// noindex/search/account/paginated pages).
export const revalidate = 3600;

// The catalog API is Typesense-backed (per_page cap 250), so page through in 250s
// up to `total`. MAX_PAGES bounds deep pagination until the catalog outgrows a
// single sitemap (Phase 3: sitemap index) — 50 pages = 12,500 products.
const PAGE_SIZE = 250;
const MAX_PAGES = 50;

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

  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        listProducts({ limit: PAGE_SIZE, offset: (i + 1) * PAGE_SIZE }),
      ),
    );
    for (const page of rest) products.push(...page.results);
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

  const entries: UrlEntry[] = [];

  // Every indexable language x indexable market pair is its own URL space.
  for (const market of INDEXABLE_MARKETS)
  for (const locale of INDEXABLE_LOCALES) {
    entries.push({ loc: `${SITE_URL}${homePath(locale, market)}`, changefreq: 'daily', priority: 1 });
    entries.push({ loc: `${SITE_URL}${listingPath('games', locale, market)}`, changefreq: 'daily', priority: 0.9 });
    entries.push({ loc: `${SITE_URL}${listingPath('categories', locale, market)}`, changefreq: 'weekly', priority: 0.6 });

    // Curated theme landing pages (the real category SEO targets). The catch-all
    // shelf is browsable but noindex, so it never enters the sitemap.
    for (const theme of INDEXABLE_THEMES) {
      entries.push({
        loc: `${SITE_URL}${entityPath('categories', locale, theme.slug[locale], market)}`,
        changefreq: 'weekly',
        priority: 0.7,
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

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">` +
    entries.map(renderUrl).join('') +
    `</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
