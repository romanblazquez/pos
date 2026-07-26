import { describe, expect, it } from 'vitest';
import { availabilityState } from './availability';
import type { Listing, ProductDetail } from './api';

const listing = (over: Partial<Listing> = {}): Listing =>
  ({ id: 'l1', priceMinorUnits: 70_000, currency: 'MXN', stock: 1, ...over } as Listing);

const product = (over: Partial<ProductDetail>): ProductDetail =>
  ({ listings: [], ...over } as ProductDetail);

describe('availability state', () => {
  it('is available when this market has a real offer', () => {
    expect(availabilityState(product({ listings: [listing()] }))).toBe('available');
  });

  it('prefers a local offer over foreign stock', () => {
    const state = availabilityState(
      product({
        listings: [listing()],
        foreignAvailability: { currencies: ['ARS'], offerCount: 3 },
      }),
    );
    expect(state).toBe('available');
  });

  it('reports no local offer when only foreign sellers stock it', () => {
    const state = availabilityState(
      product({ listings: [], foreignAvailability: { currencies: ['ARS'], offerCount: 2 } }),
    );
    expect(state).toBe('no_local_offer');
  });

  it('falls back to catalogue-only when nobody sells it anywhere', () => {
    expect(availabilityState(product({ listings: [] }))).toBe('catalogue_only');
    // A foreign block that counted zero offers is not foreign availability.
    expect(
      availabilityState(product({ foreignAvailability: { currencies: [], offerCount: 0 } })),
    ).toBe('catalogue_only');
  });

  it('does not treat a zero-priced listing as something you can buy', () => {
    // `withMarketPricing` blanks the price of an offer the market cannot
    // transact; counting it would put a buy button over nothing.
    expect(availabilityState(product({ listings: [listing({ priceMinorUnits: 0 })] }))).toBe(
      'catalogue_only',
    );
  });

  it('survives a product whose listings never arrived', () => {
    expect(availabilityState({} as ProductDetail)).toBe('catalogue_only');
  });
});
