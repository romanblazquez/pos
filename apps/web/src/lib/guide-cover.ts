// Resolve a guide's cover image = the first pick (of the first few) that has a
// product photo. Used for magazine cards on the hub and for Open Graph / Twitter
// social cards on the guide page. Cheap: at most 3 API lookups per guide, cached
// by ISR. Passing `locale` keeps the fetch on the same cache key as the page.
import { getProduct } from './api';
import type { Guide } from './guides';
import type { Locale } from './segments';

export async function guideCover(guide: Guide, locale: Locale): Promise<string | undefined> {
  for (const pick of guide.picks.slice(0, 3)) {
    const product = await getProduct(pick.gameSlug, locale);
    if (product?.images?.[0]) return product.images[0];
  }
  return undefined;
}
