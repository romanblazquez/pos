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

  it('filters offers to the market currency and active state', () => {
    expect(eligibleListingWhere('MX')).toEqual({ active: true, currency: 'MXN' });
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
    });
  });

  // Globally catalogued games stay discoverable: only ~4% of products have any
  // offer at all, so dropping the rest would gut the catalogue.
  it('never removes the product itself', () => {
    const card = { slug: 'catan', minPriceMinor: 1, currency: 'ARS' };
    expect(withMarketPricing(card, 'MX').slug).toBe('catan');
  });

  it('leaves a product with no offers untouched', () => {
    const card = { minPriceMinor: 0, maxPriceMinor: 0, currency: undefined };
    expect(withMarketPricing(card, 'MX')).toEqual(card);
  });
});
