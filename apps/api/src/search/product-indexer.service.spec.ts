import { describe, expect, it } from 'vitest';
import { aggregateListingPricing } from './product-indexer.service.js';

describe('aggregateListingPricing', () => {
  it('ranges over a single currency and names it', () => {
    const pricing = aggregateListingPricing([
      { priceMinorUnits: 59_000, currency: 'MXN' },
      { priceMinorUnits: 72_500, currency: 'MXN' },
      { priceMinorUnits: 64_000, currency: 'MXN' },
    ]);

    expect(pricing).toEqual({
      minPriceMinor: 59_000,
      maxPriceMinor: 72_500,
      currency: 'MXN',
      currencies: ['MXN'],
    });
  });

  // The defect this whole change exists to prevent: an ARS listing and an MXN
  // listing on one product must never produce a single range. 59,000 ARS and
  // 72,500 MXN are not a "price from 590 to 725" in any currency.
  it('refuses to quote a range across mixed currencies', () => {
    const pricing = aggregateListingPricing([
      { priceMinorUnits: 59_000, currency: 'ARS' },
      { priceMinorUnits: 72_500, currency: 'MXN' },
    ]);

    expect(pricing.minPriceMinor).toBe(0);
    expect(pricing.maxPriceMinor).toBe(0);
    expect(pricing.currency).toBe('');
    // Both are still reported, so the UI can say "listed in ARS and MXN"
    // instead of silently dropping half the supply.
    expect(pricing.currencies).toEqual(['ARS', 'MXN']);
  });

  it('never invents a currency for a product with no listings', () => {
    const pricing = aggregateListingPricing([]);

    expect(pricing.currency).toBe('');
    expect(pricing.currencies).toEqual([]);
    expect(pricing.minPriceMinor).toBe(0);
  });

  it('keeps a single listing as a degenerate range in its own currency', () => {
    const pricing = aggregateListingPricing([{ priceMinorUnits: 45_000, currency: 'ARS' }]);

    expect(pricing).toEqual({
      minPriceMinor: 45_000,
      maxPriceMinor: 45_000,
      currency: 'ARS',
      currencies: ['ARS'],
    });
  });

  it('reports currencies deterministically so index writes do not churn', () => {
    const a = aggregateListingPricing([
      { priceMinorUnits: 1, currency: 'MXN' },
      { priceMinorUnits: 2, currency: 'ARS' },
    ]);
    const b = aggregateListingPricing([
      { priceMinorUnits: 2, currency: 'ARS' },
      { priceMinorUnits: 1, currency: 'MXN' },
    ]);

    expect(a.currencies).toEqual(b.currencies);
  });
});
