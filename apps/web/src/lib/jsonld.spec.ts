import { describe, expect, it } from 'vitest';
import { productLd } from './jsonld';
import type { Listing, ProductDetail } from './api';

function listing(over: Partial<Listing>): Listing {
  return {
    id: 'l1',
    sellerId: 's1',
    sellerName: 'Tienda',
    sellerSlug: 'tienda',
    sellerScore: 5,
    priceMinorUnits: 70_000,
    currency: 'MXN',
    stock: 3,
    stockStatus: 'in_stock',
    deliveryOptions: [],
    lastSyncedAt: '2026-07-26T00:00:00.000Z',
    ...over,
  };
}

function product(listings: Listing[]): ProductDetail {
  return { name: 'Catan', slug: 'catan', listings } as ProductDetail;
}

const path = '/es-mx/juegos-de-mesa/catan';

describe('product structured data', () => {
  it('never publishes an offer in a currency this market does not transact in', () => {
    const node = productLd(
      product([
        listing({ id: 'mx', currency: 'MXN', priceMinorUnits: 70_000 }),
        listing({ id: 'ar1', currency: 'ARS', priceMinorUnits: 4_500_000 }),
        listing({ id: 'ar2', currency: 'ARS', priceMinorUnits: 5_100_000 }),
      ]),
      path,
      'MXN',
    ) as Record<string, any>;

    // One eligible offer survives, so it is a plain Offer, not an aggregate —
    // and crucially the ARS amounts are not relabelled as pesos.
    expect(node.offers['@type']).toBe('Offer');
    expect(node.offers.priceCurrency).toBe('MXN');
    expect(node.offers.price).toBe('700.00');
  });

  it('takes the aggregate currency from the offers, not from whichever sorted first', () => {
    const node = productLd(
      product([
        listing({ id: 'ar1', currency: 'ARS', priceMinorUnits: 4_500_000 }),
        listing({ id: 'ar2', currency: 'ARS', priceMinorUnits: 5_100_000 }),
      ]),
      '/es-ar/juegos-de-mesa/catan',
      'ARS',
    ) as Record<string, any>;

    expect(node.offers['@type']).toBe('AggregateOffer');
    expect(node.offers.priceCurrency).toBe('ARS');
    expect(node.offers.lowPrice).toBe('45000.00');
    expect(node.offers.highPrice).toBe('51000.00');
    expect(node.offers.offerCount).toBe(2);
    expect(node.offers.offers).toHaveLength(2);
  });

  it('omits offers entirely rather than inventing a price for a catalogue-only page', () => {
    expect(productLd(product([]), path, 'MXN')).not.toHaveProperty('offers');

    // A zero price and a blank currency both reach us from real index rows.
    const junk = productLd(
      product([
        listing({ id: 'free', priceMinorUnits: 0 }),
        listing({ id: 'blank', currency: '' }),
      ]),
      path,
      'MXN',
    );
    expect(junk).not.toHaveProperty('offers');
  });

  it('scales minor units by the currency, never by a hardcoded hundred', () => {
    // CLP has no minor unit: 51_000 minor units is $51,000, not $510.
    const node = productLd(
      product([listing({ currency: 'CLP', priceMinorUnits: 51_000 })]),
      '/es-cl/juegos-de-mesa/catan',
      'CLP',
    ) as Record<string, any>;
    expect(node.offers.price).toBe('51000.00');
  });

  it('still emits offers when no market currency is supplied, matching prior behaviour', () => {
    const node = productLd(product([listing({})]), path) as Record<string, any>;
    expect(node.offers.priceCurrency).toBe('MXN');
  });
});
