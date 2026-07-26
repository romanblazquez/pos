import { describe, expect, it } from 'vitest';
import {
  eligibleListingWhere,
  marketCurrency,
  summariseForeignAvailability,
  withMarketPricing,
} from './market-eligibility.js';

describe('market eligibility', () => {
  it('serves each market exactly one currency', () => {
    expect(marketCurrency('MX')).toBe('MXN');
    expect(marketCurrency('mx')).toBe('MXN');
  });

  it('falls back to the default market rather than serving nothing', () => {
    expect(marketCurrency(undefined)).toBe('MXN');
    expect(marketCurrency('ZZ')).toBe('MXN');
  });

  it('requires the seller to have declared the market, and the money to match', () => {
    const where = eligibleListingWhere('MX');
    expect(where.active).toBe(true);
    expect(where.currency).toBe('MXN');
    // Seller declaration is the authoritative signal: a seller decides which
    // markets they serve. Currency stays as a guard so a seller who declares
    // Mexico cannot put an ARS price on a Mexican page.
    expect(where.seller.canonicalMarkets.some.active).toBe(true);
    expect(where.seller.canonicalMarkets.some.commerceMarket).toEqual({ code: 'MX', active: true });
  });

  it('never matches offers through an inactive market', () => {
    expect(eligibleListingWhere('MX').seller.canonicalMarkets.some.commerceMarket.active).toBe(true);
  });

  // The defect this exists to prevent: an Argentine price on a Mexican page,
  // where "cheapest" silently compares numbers on different scales.
  it('excludes offers quoted in another market currency', () => {
    const where = eligibleListingWhere('MX');
    const listings = [
      { currency: 'MXN', priceMinorUnits: 59_000 },
      { currency: 'ARS', priceMinorUnits: 320_000 },
    ];
    const visible = listings.filter((l) => l.currency === where.currency);
    expect(visible).toHaveLength(1);
    expect(visible[0].currency).toBe('MXN');
  });

  it('reports what exists elsewhere so filtering is not a dead end', () => {
    const foreign = summariseForeignAvailability(
      [
        { currency: 'MXN' },
        { currency: 'ARS' },
        { currency: 'ARS' },
      ],
      'MX',
    );
    expect(foreign).toEqual({ currencies: ['ARS'], offerCount: 2 });
  });

  it('reports nothing foreign when every offer is local', () => {
    expect(summariseForeignAvailability([{ currency: 'MXN' }], 'MX')).toEqual({
      currencies: [],
      offerCount: 0,
    });
  });

  it('ignores inactive offers when counting foreign availability', () => {
    const foreign = summariseForeignAvailability(
      [{ currency: 'ARS', active: false }, { currency: 'ARS', active: true }],
      'MX',
    );
    expect(foreign.offerCount).toBe(1);
  });
});

describe('withMarketPricing', () => {
  it('keeps a price quoted in the market currency', () => {
    const card = { minPriceMinor: 59_000, maxPriceMinor: 72_000, currency: 'MXN' };
    expect(withMarketPricing(card, 'MX')).toEqual(card);
  });

  // The listing-grid version of the same defect: an ARS amount on a Mexican
  // catalogue page, where it is harder to spot than on a product page.
  it('blanks a price quoted in another market currency', () => {
    const card = { minPriceMinor: 320_000, maxPriceMinor: 320_000, currency: 'ARS' };
    expect(withMarketPricing(card, 'MX')).toEqual({
      minPriceMinor: 0,
      maxPriceMinor: 0,
      currency: undefined,
      // "sold, but not here" — distinct from having no offers at all.
      availableElsewhere: true,
    });
  });

  // Globally catalogued games stay discoverable: only ~4% of products have any
  // offer at all, so dropping the rest would gut the catalogue.
  it('never removes the product itself', () => {
    const card = { slug: 'catan', minPriceMinor: 1, currency: 'ARS' };
    expect(withMarketPricing(card, 'MX').slug).toBe('catan');
  });

  it('leaves a product with no offers untouched, and unflagged', () => {
    const card = { minPriceMinor: 0, maxPriceMinor: 0, currency: undefined };
    const result = withMarketPricing(card, 'MX');
    expect(result).toEqual(card);
    expect(result.availableElsewhere).toBeUndefined();
  });
});

describe('empty currency normalisation', () => {
  // The index stores '' for products with no offers or mixed currencies. That
  // value reached a client and was passed to Intl.NumberFormat, which throws —
  // crashing the page rather than spoiling one price. Never emit it.
  it('never emits an empty currency string', () => {
    const result = withMarketPricing({ minPriceMinor: 0, maxPriceMinor: 0, currency: '' }, 'MX');
    expect(result.currency).toBeUndefined();
  });

  it('does not mistake an empty currency for a foreign one', () => {
    const result = withMarketPricing({ minPriceMinor: 0, maxPriceMinor: 0, currency: '' }, 'MX');
    expect(result.availableElsewhere).toBeUndefined();
  });
});
