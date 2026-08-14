import { SITE_URL } from '@/lib/site';
import {
  CHUNK_SIZE,
  indexableProductCount,
  marketLocalePairs,
  xmlEscape,
  xmlResponse,
} from '@/lib/sitemap';

// Sitemap INDEX (spec §7). Was a single <urlset>, which could not work: the
// sitemap protocol caps one file at 50,000 URLs and the indexable catalogue is
// past 155,000 products. The old file also derived its page count from a
// cached `total`, so in practice it published ~27,750 of them — under a fifth
// of the catalogue, silently, with the rest simply never announced to Google.
//
// Children live at /sitemaps/*.xml. robots.txt points here, and Google follows
// an index the same way it follows a urlset.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  let total: number;
  try {
    total = await indexableProductCount();
  } catch {
    // An index built on a failed count would omit real chunks; 503 makes the
    // crawler retry instead of accepting a shrunken site.
    return new Response('sitemap temporarily unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '600' },
    });
  }
  const pairs = Math.max(marketLocalePairs().length, 1);
  const perPair = Math.ceil(CHUNK_SIZE / pairs);
  // At least one product chunk even on an empty catalogue, so the index is
  // never a bare document that looks like a broken deploy.
  const chunks = Math.max(1, Math.ceil(total / perPair));

  const files = [
    `${SITE_URL}/sitemaps/taxonomy.xml`,
    ...Array.from({ length: chunks }, (_, i) => `${SITE_URL}/sitemaps/products-${i}.xml`),
  ];

  const lastmod = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>`
    + `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
    + files.map((loc) => `<sitemap><loc>${xmlEscape(loc)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('')
    + `</sitemapindex>`;

  return xmlResponse(body);
}
