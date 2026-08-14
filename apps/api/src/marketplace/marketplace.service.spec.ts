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
      groupBy: vi.fn().mockResolvedValue([]),
    },
    language: { findFirst: vi.fn() },
    entityLocalization: { findMany: vi.fn() },
  };
  const search = {
    search: vi.fn().mockResolvedValue({ hits: [], total: 0 }),
    categoryCounts: vi.fn().mockResolvedValue(new Map()),
    tagCounts: vi.fn().mockResolvedValue(new Map()),
    publisherCounts: vi.fn().mockResolvedValue(new Map()),
  };
  const semantic = { search: vi.fn().mockResolvedValue([]), similar: vi.fn().mockResolvedValue([]) };
  const service = new MarketplaceService(prisma as never, search as never, semantic as never);
  return { service, prisma, search, semantic };
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
        AND: expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([{ category: 'board-game' }]),
          }),
        ]),
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

  it('overlays an approved localization on Typesense hits', async () => {
    const { service, prisma, search } = setup();
    prisma.language.findFirst.mockResolvedValue({ id: 'language_es_mx' });
    prisma.entityLocalization.findMany.mockResolvedValue([{
      entityId: 'p1',
      title: 'Catán',
      description: 'Comercia y construye.',
    }]);
    search.search.mockResolvedValue({
      total: 1,
      hits: [{ ...product, language: 'en', bggWeight: 2.3, totalListings: 1, inStockListings: 1 }],
    });

    const result = await service.searchProducts({}, 'es');

    expect(result.results[0]).toMatchObject({
      name: 'Catán',
      description: 'Comercia y construye.',
    });
    expect(prisma.language.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ code: 'es' }, { iso6391: 'es' }] },
    });
  });

  it('resolves a browse category through the search index, not the narrower DB path', async () => {
    const { service, prisma, search } = setup();
    search.search.mockResolvedValue({
      total: 466,
      hits: [{ ...product, categorySlugs: ['coop'], language: 'es', bggWeight: 2.3, totalListings: 0, inStockListings: 0 }],
    });

    const result = await service.searchProducts({ category: 'coop', limit: 48, offset: 96 });

    expect(search.search).toHaveBeenCalledWith(expect.objectContaining({
      category: 'coop', limit: 48, offset: 96,
    }));
    // The Prisma path only sees verified products with an active listing, so
    // taking it would shrink the category and collapse its pagination.
    expect(prisma.mktProduct.findMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ total: 466, source: 'search' });
  });

  it('serves a page past the end as empty instead of falling back to the DB', async () => {
    const { service, prisma, search } = setup();
    search.search.mockResolvedValue({ total: 466, hits: [] });

    const result = await service.searchProducts({ category: 'coop', limit: 48, offset: 4800 });

    expect(prisma.mktProduct.findMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ results: [], total: 466 });
  });

  it('reads mechanic counts from the search index instead of the verified+active-only DB path', async () => {
    const { service, prisma, search } = setup();
    search.tagCounts.mockResolvedValue(new Map([['Deck Building', 900], ['Party Game', 40]]));

    const result = await service.getMechanics();

    expect(prisma.mktProduct.findMany).not.toHaveBeenCalled();
    expect(result).toEqual([
      { mechanic: 'Deck Building', count: 900 },
      { mechanic: 'Party Game', count: 40 },
    ]);
  });

  it('falls back to the DB for mechanics when the search index is empty', async () => {
    const { service, prisma, search } = setup();
    search.tagCounts.mockResolvedValue(new Map());

    const result = await service.getMechanics();

    expect(prisma.mktProduct.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { canonicalStatus: 'verified', listings: { some: { active: true } } },
    }));
    expect(result).toEqual([{ mechanic: 'trading', count: 1 }]);
  });

  it('reads publisher facets from the search index instead of the verified+active-only DB path', async () => {
    const { service, prisma, search } = setup();
    search.publisherCounts.mockResolvedValue(new Map([['KOSMOS', 12], ['Asmodee', 5]]));

    const result = await service.getFacets();

    expect(prisma.mktProduct.groupBy).not.toHaveBeenCalledWith(
      expect.objectContaining({ by: ['publisher'] }),
    );
    expect(result.publishers).toEqual([
      { value: 'KOSMOS', count: 12 },
      { value: 'Asmodee', count: 5 },
    ]);
  });

  it('drops BGG\'s bracketed non-publisher placeholders from the publisher facet', async () => {
    const { service, search } = setup();
    search.publisherCounts.mockResolvedValue(new Map([
      ['KOSMOS', 12],
      ['(Self-Published)', 900],
      ['(Web published)', 400],
      ['(Unknown)', 200],
    ]));

    const result = await service.getFacets();

    expect(result.publishers).toEqual([{ value: 'KOSMOS', count: 12 }]);
  });

  it('uses semantic retrieval only for an unfiltered natural-language query', async () => {
    const { service, semantic, search } = setup();
    semantic.search.mockResolvedValue([]);

    await service.searchProducts({ q: 'cooperative mystery for two players', semantic: true }, 'en');
    expect(semantic.search).toHaveBeenCalledWith('cooperative mystery for two players', 'en', 24);

    semantic.search.mockClear();
    await service.searchProducts({ q: 'cooperative mystery for two players', semantic: true, minPlayers: 2 }, 'en');
    expect(semantic.search).not.toHaveBeenCalled();
    expect(search.search).toHaveBeenCalled();
  });
});
