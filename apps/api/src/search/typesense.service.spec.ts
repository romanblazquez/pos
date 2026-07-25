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
      ],
    })).toBe(false);
  });

  it('still detects schema versions that cannot support current queries', () => {
    expect(collectionNeedsRecreation({
      num_documents: 10,
      default_sorting_field: 'inStockListings',
      fields: [{ name: 'name', sort: false }, { name: 'nameEs' }],
    })).toBe(true);
  });
});
