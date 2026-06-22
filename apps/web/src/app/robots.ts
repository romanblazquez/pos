import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// robots.txt (spec §8). Allows public catalog, blocks private/non-SEO routes,
// references the sitemap index. Assets are NOT blocked (needed for rendering).
// NOTE: site-wide indexing also remains gated upstream until the marketplace
// SEO launch — flip the Traefik noindex middleware off in lockstep with this.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/*/buscar', // search results (es)
          '/*/search', // search results (en)
          '/*/cuenta', // account
          '/*/account',
          '/*?*', // query-parameter / faceted URLs (avoid index bloat)
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
