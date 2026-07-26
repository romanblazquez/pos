// Localized URL architecture (spec §2, §3).
//
// Every indexable entity lives under /{locale}/{localized-segment}/{slug}.
// The segment itself is localized (es: juegos-de-mesa, en: board-games), which
// is why routing is done through a single dynamic [locale]/[type] resolver
// rather than hardcoded route folders — it keeps slugs human-readable and
// localized while letting one code path build canonical + hreflang for all.

// LANGUAGE. Controls copy, metadata language, localized slugs and hreflang's
// language subtag. Deliberately NOT the market: the same language is spoken
// across many markets, and merging the two is what makes an Argentine price
// show up on a Mexican page.
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

// MARKET. Controls eligible sellers, shipping destination, canonical currency,
// tax treatment and price comparison. Mirrors the `commerce_market` /
// `commerce_market_locale` rows the API owns; this map is the routing-layer view
// of them, so adding Spain is a config entry plus a database row, never a code
// change in a page or component.
export interface Market {
  /** Uppercase market code, conventionally the ISO country code. */
  code: string;
  /** Human market name shown to shoppers, in the market's own language. */
  name: string;
  /** Lowercase URL segment component: /es-mx. */
  urlCode: string;
  countryCode: string;
  canonicalCurrency: string;
  /** Languages this market publishes, most-default first. */
  languages: readonly Locale[];
}

export const MARKETS: Readonly<Record<string, Market>> = {
  mx: {
    code: 'MX',
    name: 'México',
    urlCode: 'mx',
    countryCode: 'MX',
    canonicalCurrency: 'MXN',
    languages: ['es', 'en'],
  },
};

export const DEFAULT_MARKET = 'mx';

/** Markets whose pages may be indexed right now. */
export const INDEXABLE_MARKETS: readonly string[] = ['mx'];

/**
 * The URL prefix for a language×market pair: ('es','mx') -> 'es-mx'.
 * Lowercase throughout — one canonical casing, enforced by the middleware.
 */
export function localePrefix(locale: Locale, market: string = DEFAULT_MARKET): string {
  return `${locale}-${market.toLowerCase()}`;
}

/** BCP-47 tag for hreflang/`<html lang>`: ('es','mx') -> 'es-MX'. */
export function bcp47(locale: Locale, market: string = DEFAULT_MARKET): string {
  return `${locale}-${(MARKETS[market.toLowerCase()]?.countryCode ?? market).toUpperCase()}`;
}

export interface ParsedLocalePrefix {
  locale: Locale;
  market: string;
}

/**
 * Parse a URL prefix back into its language and market. Returns null for
 * anything not configured, so an unknown market 404s rather than silently
 * rendering the default market's commercial terms under a foreign URL.
 */
export function parseLocalePrefix(prefix: string): ParsedLocalePrefix | null {
  const [language, market] = prefix.split('-');
  if (!isLocale(language) || !market) return null;
  const configured = MARKETS[market.toLowerCase()];
  if (!configured || !configured.languages.includes(language)) return null;
  return { locale: language, market: configured.urlCode };
}

/** Every active language×market prefix — drives routing, sitemaps and hreflang. */
export function allLocalePrefixes(): ParsedLocalePrefix[] {
  return Object.values(MARKETS).flatMap((market) =>
    market.languages.map((locale) => ({ locale, market: market.urlCode })),
  );
}

// Locales whose pages are allowed to be indexed RIGHT NOW. English routes
// exist and render, but stay noindex + self-canonical until real (non-machine)
// translations land — so we never feed Google low-quality MT (spec §3).
// Flip to ['es', 'en'] in one place when EN content is genuinely ready.
export const INDEXABLE_LOCALES: readonly Locale[] = ['es'];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function isIndexable(locale: Locale): boolean {
  return INDEXABLE_LOCALES.includes(locale);
}

// Entity kinds and their localized path segments.
export type EntityKind =
  | 'games' | 'categories' | 'publishers' | 'mechanics' | 'stores' | 'search' | 'guides' | 'editors';

export const SEGMENTS: Record<EntityKind, Record<Locale, string>> = {
  games: { es: 'juegos-de-mesa', en: 'board-games' },
  categories: { es: 'categorias', en: 'categories' },
  publishers: { es: 'editoriales', en: 'publishers' },
  mechanics: { es: 'mecanicas', en: 'mechanics' },
  stores: { es: 'tiendas', en: 'stores' },
  search: { es: 'buscar', en: 'search' },
  // Editorial hub — guides/best-of lists that interlink with catalog pages.
  guides: { es: 'guias', en: 'guides' },
  // Author profiles behind the bylines — the E-E-A-T destination every guide's
  // byline and Article/Person `url` points at.
  editors: { es: 'editores', en: 'editors' },
};

/** Resolve a localized path segment back to its entity kind, scoped to locale. */
export function resolveKind(locale: Locale, segment: string): EntityKind | null {
  for (const kind of Object.keys(SEGMENTS) as EntityKind[]) {
    if (SEGMENTS[kind][locale] === segment) return kind;
  }
  return null;
}

export function segmentFor(kind: EntityKind, locale: Locale): string {
  return SEGMENTS[kind][locale];
}

// Path builders take the market as an optional trailing argument so the ~110
// existing call sites keep working against the default market. Pages that know
// their market (every route does — it is in the URL) should pass it explicitly;
// once a second market is live, an omitted market is a bug waiting to link a
// shopper out of their own market.

/** Path to a listing root, e.g. /es-mx/juegos-de-mesa. */
export function listingPath(
  kind: EntityKind,
  locale: Locale,
  market: string = DEFAULT_MARKET,
): string {
  return `/${localePrefix(locale, market)}/${segmentFor(kind, locale)}`;
}

/** Path to an entity detail, e.g. /es-mx/juegos-de-mesa/catan. */
export function entityPath(
  kind: EntityKind,
  locale: Locale,
  slug: string,
  market: string = DEFAULT_MARKET,
): string {
  return `${listingPath(kind, locale, market)}/${slug}`;
}

export function homePath(locale: Locale, market: string = DEFAULT_MARKET): string {
  return `/${localePrefix(locale, market)}`;
}

// Lowercase, hyphenated, ASCII-folded slug (spec §2). Stable + human-readable.
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
