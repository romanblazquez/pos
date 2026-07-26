import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MARKET,
  MARKETS,
  allLocalePrefixes,
  bcp47,
  entityPath,
  homePath,
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
    expect(parseLocalePrefix('es')).toBeNull();
    expect(parseLocalePrefix('')).toBeNull();
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
