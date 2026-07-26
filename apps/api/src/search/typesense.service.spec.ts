import { describe, expect, it } from 'vitest';
import { collectionNeedsRecreation } from './typesense.service.js';

describe('Typesense collection lifecycle', () => {
  it('never treats a large valid catalogue as corruption', () => {
    expect(collectionNeedsRecreation({
      num_documents: 200_000,
      default_sorting_field: 'inStockListings',
      fields: [
        { name: 'name', sort: true },
        { name: 'nameEs' },
        { name: 'currency' },
      ],
    })).toBe(false);
  });

  // An index predating the currency field prices every product in the house
  // currency, so roughly half the catalogue (the ARS listings) reads as pesos.
  // That is worth a full rebuild, not a warning.
  it('rebuilds an index that cannot tell one currency from another', () => {
    expect(collectionNeedsRecreation({
      num_documents: 200_000,
      default_sorting_field: 'inStockListings',
      fields: [
        { name: 'name', sort: true },
        { name: 'nameEs' },
      ],
    })).toBe(true);
  });

  it('still detects schema versions that cannot support current queries', () => {
    expect(collectionNeedsRecreation({
      num_documents: 10,
      default_sorting_field: 'inStockListings',
      fields: [{ name: 'name', sort: false }, { name: 'nameEs' }],
    })).toBe(true);
  });
});
