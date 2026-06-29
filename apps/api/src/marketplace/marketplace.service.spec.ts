import { describe, expect, it, vi } from 'vitest';
import { MarketplaceService } from './marketplace.service.js';

const product = {
  id: 'p1',
  slug: 'catan',
  name: 'Catan',
  images: ['catan.jpg'],
  category: 'board-game',
  tags: ['trading'],
  description: 'Trade and build.',
  publisher: 'KOSMOS',
  minPlayers: 3,
  maxPlayers: 4,
  minAge: 10,
  playTimeMinutes: 60,
  bggRating: 7.1,
  listings: [{ priceMinorUnits: 49_900, currency: 'MXN', stockStatus: 'in_stock' }],
};

function setup() {
  const prisma = {
    mktProduct: {
      findMany: vi.fn().mockResolvedValue([product]),
      count: vi.fn().mockResolvedValue(1),
    },
  };
  const search = { search: vi.fn().mockResolvedValue({ hits: [], total: 0 }) };
  const service = new MarketplaceService(prisma as never, search as never);
  return { service, prisma, search };
}

describe('MarketplaceService search filters', () => {
  it('applies stock, price, player, and category filters in the Prisma fallback', async () => {
    const { service, prisma } = setup();

    const result = await service.searchProducts({
      q: 'catan',
      category: 'board-game',
      inStockOnly: true,
      maxPrice: 50_000,
      minPlayers: 4,
    });

    expect(prisma.mktProduct.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        category: 'board-game',
        minPlayers: { lte: 4 },
        maxPlayers: { gte: 4 },
        listings: {
          some: {
            active: true,
            stockStatus: { not: 'out_of_stock' },
            priceMinorUnits: { lte: 50_000 },
          },
        },
      }),
    }));
    expect(result.results[0]).toMatchObject({ category: 'board-game', tags: ['trading'] });
  });

  it('returns grouped product and facet suggestions', async () => {
    const { service, search } = setup();
    search.search.mockResolvedValue({
      total: 1,
      hits: [{ ...product, language: 'es', bggWeight: 2.3, totalListings: 2, inStockListings: 2 }],
    });

    const result = await service.getSuggestions('catn', 6);

    expect(result.products[0]).toMatchObject({ slug: 'catan', label: 'Catan' });
    expect(result.publishers).toEqual([{ kind: 'publisher', label: 'KOSMOS', value: 'KOSMOS' }]);
    expect(result.categories).toEqual([{ kind: 'category', label: 'board-game', value: 'board-game' }]);
    expect(result.mechanics).toEqual([{ kind: 'mechanic', label: 'trading', value: 'trading' }]);
  });
});
