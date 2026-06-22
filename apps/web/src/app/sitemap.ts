import type { MetadataRoute } from 'next';
import { listProducts, getCategories } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import {
  INDEXABLE_LOCALES,
  entityPath,
  homePath,
  listingPath,
  slugify,
} from '@/lib/segments';

export const revalidate = 3600;

// Sitemap (spec §7). Includes ONLY canonical, indexable URLs — so it iterates
// INDEXABLE_LOCALES (es today; es+en when EN content is real) and never emits
// noindex/search/account pages. Split named sitemaps + 50k pagination land in
// Phase 3; for the product+category slice a single sitemap is correct.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ results: products }, categories] = await Promise.all([
    listProducts({ limit: 5000 }),
    getCategories(),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of INDEXABLE_LOCALES) {
    entries.push({ url: `${SITE_URL}${homePath(locale)}`, changeFrequency: 'daily', priority: 1 });
    entries.push({
      url: `${SITE_URL}${listingPath('games', locale)}`,
      changeFrequency: 'daily',
      priority: 0.9,
    });
    entries.push({
      url: `${SITE_URL}${listingPath('categories', locale)}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    });

    for (const c of categories) {
      entries.push({
        url: `${SITE_URL}${entityPath('categories', locale, slugify(c.category))}`,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }

    for (const p of products) {
      entries.push({
        url: `${SITE_URL}${entityPath('games', locale, p.slug)}`,
        changeFrequency: 'daily',
        priority: 0.8,
      });
    }
  }

  return entries;
}
