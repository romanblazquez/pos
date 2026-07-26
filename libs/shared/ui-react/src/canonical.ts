/**
 * Canonical URL rules, shared by every host.
 *
 * The transactional app renders the same product as the public site and had its
 * own idea of where the canonical pointed — at `/es/juegos-de-mesa/{slug}`, a
 * language-only URL that the public site 301s away to `/es-mx/...`. A canonical
 * that redirects is a wasted hop at best and an ignored signal at worst, and it
 * is exactly the kind of thing that only breaks once the two implementations
 * drift. There is one implementation now.
 */

export const SITE_ORIGIN = 'https://juegospedia.com';

export type SeoLocale = 'es' | 'en';

/** Localized path segment for the product listing, mirroring apps/web SEGMENTS. */
const GAMES_SEGMENT: Record<SeoLocale, string> = {
  es: 'juegos-de-mesa',
  en: 'board-games',
};

/**
 * The one URL a product should be indexed at.
 *
 * Commerce is market-scoped — price, sellers and tax all vary — so the prefix
 * carries both language and market (`/es-mx`), never language alone.
 */
export function canonicalProductPath(
  locale: SeoLocale,
  market: string,
  slug: string,
): string {
  return `/${locale}-${market.toLowerCase()}/${GAMES_SEGMENT[locale]}/${slug}`;
}

export function canonicalProductUrl(locale: SeoLocale, market: string, slug: string): string {
  return `${SITE_ORIGIN}${canonicalProductPath(locale, market, slug)}`;
}

export function canonicalHomeUrl(locale: SeoLocale, market: string): string {
  return `${SITE_ORIGIN}/${locale}-${market.toLowerCase()}`;
}

const CATEGORIES_SEGMENT: Record<SeoLocale, string> = {
  es: 'categorias',
  en: 'categories',
};

/** The listing of every game — where a bare search belongs. */
export function canonicalGamesUrl(locale: SeoLocale, market: string): string {
  return `${SITE_ORIGIN}/${locale}-${market.toLowerCase()}/${GAMES_SEGMENT[locale]}`;
}

/**
 * A browsable category, or the category index when no slug is given.
 *
 * The app's own `/search?category=…` is a filtered view, not a canonical
 * destination: the public site has a real page per category, and robots.txt
 * disallows both `/search` and anything carrying a query string. Canonicalising
 * to a URL that is redirected AND disallowed points the crawler at nothing.
 */
export function canonicalCategoryUrl(
  locale: SeoLocale,
  market: string,
  slug?: string,
): string {
  const base = `${SITE_ORIGIN}/${locale}-${market.toLowerCase()}/${CATEGORIES_SEGMENT[locale]}`;
  return slug ? `${base}/${encodeURIComponent(slug)}` : base;
}

/**
 * Social card image.
 *
 * Query-free and outside `/api/`, because robots.txt disallows both and the
 * crawlers that build link previews — Twitterbot, facebookexternalhit — obey
 * it. A card image behind a query string simply never loads, silently.
 */
export function socialCardUrl(
  kind: 'product' | 'category',
  locale: SeoLocale,
  slug: string,
): string {
  return `${SITE_ORIGIN}/og/${kind}/${locale}/${encodeURIComponent(slug)}.png`;
}
