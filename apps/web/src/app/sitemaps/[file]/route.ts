import { notFound } from 'next/navigation';
import {
  memoisedXml,
  productEntriesForChunk,
  renderUrlSet,
  taxonomyEntries,
  xmlResponse,
} from '@/lib/sitemap';

// Child sitemaps referenced by the index at /sitemap.xml:
//   /sitemaps/taxonomy.xml     hubs, themes, publishers, mechanics, stores, editorial
//   /sitemaps/products-<n>.xml one chunk of the product URL space
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { file: string } },
): Promise<Response> {
  const file = params.file;

  const match = /^products-(\d+)\.xml$/.exec(file);
  // 404 rather than an empty urlset for anything else: an empty file tells a
  // crawler "this part of the site is gone", which is a costly thing to say by
  // accident on a typo'd path.
  if (file !== 'taxonomy.xml' && !match) notFound();

  try {
    const body = await memoisedXml(file, async () => renderUrlSet(
      file === 'taxonomy.xml'
        ? await taxonomyEntries()
        : await productEntriesForChunk(Number(match![1])),
    ));
    return xmlResponse(body);
  } catch {
    // Serving a short or empty file would tell Google these URLs no longer
    // exist. 503 says "ask again later", which is the recoverable answer.
    return new Response('sitemap temporarily unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '600' },
    });
  }
}
