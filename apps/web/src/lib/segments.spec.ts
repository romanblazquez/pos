import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MARKET,
  MARKETS,
  allLocalePrefixes,
  bcp47,
  entityPath,
  homePath,
  isIndexable,
  listingPath,
  localePrefix,
  parseLocalePrefix,
} from './segments.js';

describe('language × market URLs', () => {
  it('builds a lowercase language-market prefix', () => {
    expect(localePrefix('es', 'mx')).toBe('es-mx');
    expect(localePrefix('en', 'MX')).toBe('en-mx');
  });

  it('emits BCP-47 with an uppercase region for hreflang', () => {
    expect(bcp47('es', 'mx')).toBe('es-MX');
    expect(bcp47('en', 'mx')).toBe('en-MX');
  });

  it('puts the market in every public path', () => {
    expect(homePath('es', 'mx')).toBe('/es-mx');
    expect(listingPath('games', 'es', 'mx')).toBe('/es-mx/juegos-de-mesa');
    expect(entityPath('games', 'es', 'catan', 'mx')).toBe('/es-mx/juegos-de-mesa/catan');
    expect(entityPath('games', 'en', 'catan', 'mx')).toBe('/en-mx/board-games/catan');
  });

  it('round-trips a prefix back to its language and market', () => {
    expect(parseLocalePrefix('es-mx')).toEqual({ locale: 'es', market: 'mx' });
    expect(parseLocalePrefix('en-mx')).toEqual({ locale: 'en', market: 'mx' });
  });

  // A market we do not serve must 404, never fall back to Mexico's commercial
  // terms rendered under someone else's country in the URL.
  it('routes a second market with no code change beyond its config entry', () => {
    expect(parseLocalePrefix('es-ar')).toEqual({ locale: 'es', market: 'ar' });
    expect(entityPath('games', 'es', 'catan', 'ar')).toBe('/es-ar/juegos-de-mesa/catan');
    expect(bcp47('es', 'ar')).toBe('es-AR');
  });

  it('rejects prefixes for markets that are not configured', () => {
    expect(parseLocalePrefix('es-es')).toBeNull();
    expect(parseLocalePrefix('en-us')).toBeNull();
    expect(parseLocalePrefix('fr-mx')).toBeNull();
    expect(parseLocalePrefix('')).toBeNull();
    // A bare language is no longer invalid — it is the editorial prefix.
    expect(parseLocalePrefix('es')?.languageOnly).toBe(true);
  });

  it('enumerates exactly the language×market pairs that are configured', () => {
    expect(allLocalePrefixes().map((p) => localePrefix(p.locale, p.market)).sort())
      .toEqual(['en-ar', 'en-mx', 'es-ar', 'es-mx']);
  });

  it('defaults every path builder to the default market', () => {
    expect(listingPath('guides', 'es')).toBe(listingPath('guides', 'es', DEFAULT_MARKET));
  });

  // Adding Spain must be a config entry, not a code change. This asserts the
  // shape the routing layer reads, so a new market lights up routes on its own.
  it('derives routing entirely from market configuration', () => {
    expect(MARKETS[DEFAULT_MARKET]).toMatchObject({
      code: 'MX',
      countryCode: 'MX',
      canonicalCurrency: 'MXN',
    });
    expect(MARKETS[DEFAULT_MARKET].languages).toContain('es');
  });
});

describe('indexability', () => {
  // Argentina serves real shoppers at /es-ar in an indexable language, but is
  // not open to crawlers. Checking only the language let those pages advertise
  // `index, follow` while the sitemap correctly omitted them — a contradiction
  // Google resolves by trusting neither.
  it('requires the market to be indexable, not just the language', () => {
    expect(isIndexable('es', 'mx')).toBe(true);
    expect(isIndexable('es', 'ar')).toBe(false);
  });

  it('keeps a non-indexable language non-indexable in every market', () => {
    expect(isIndexable('en', 'mx')).toBe(false);
    expect(isIndexable('en', 'ar')).toBe(false);
  });

  it('defaults to the default market when none is given', () => {
    expect(isIndexable('es')).toBe(isIndexable('es', DEFAULT_MARKET));
  });
});

describe('market-neutral editorial URLs', () => {
  // Editorial carries no prices, so publishing it under every market prefix
  // would put identical prose at several URLs competing with each other.
  it('gives guides and editor profiles a language-only URL', () => {
    expect(listingPath('guides', 'es', 'mx')).toBe('/es/guias');
    expect(listingPath('guides', 'es', 'ar')).toBe('/es/guias');
    expect(listingPath('editors', 'en', 'ar')).toBe('/en/editors');
  });

  it('ignores the market argument entirely for those kinds', () => {
    expect(listingPath('guides', 'es', 'mx')).toBe(listingPath('guides', 'es', 'ar'));
  });

  it('keeps commercial kinds market-scoped', () => {
    expect(listingPath('games', 'es', 'mx')).toBe('/es-mx/juegos-de-mesa');
    expect(listingPath('games', 'es', 'ar')).toBe('/es-ar/juegos-de-mesa');
    expect(listingPath('categories', 'es', 'ar')).toBe('/es-ar/categorias');
  });

  it('parses a bare language as an editorial prefix', () => {
    expect(parseLocalePrefix('es')).toEqual({ locale: 'es', market: DEFAULT_MARKET, languageOnly: true });
  });

  it('still rejects an unconfigured market', () => {
    expect(parseLocalePrefix('es-es')).toBeNull();
    expect(parseLocalePrefix('fr')).toBeNull();
  });
});
