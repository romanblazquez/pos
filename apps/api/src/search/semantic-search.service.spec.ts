import { describe, expect, it, vi } from 'vitest';
import { cosine, SemanticSearchService } from './semantic-search.service.js';

describe('semantic vector scoring', () => {
  it('ranks identical vectors above unrelated vectors', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('rejects empty and dimension-mismatched vectors', () => {
    expect(cosine([], [])).toBe(Number.NEGATIVE_INFINITY);
    expect(cosine([1], [1, 2])).toBe(Number.NEGATIVE_INFINITY);
  });

  it('deduplicates concurrent queries and caches normalized repeats', async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
    try {
      const create = vi.fn().mockResolvedValue({ data: [{ index: 0, embedding: [1, 0] }] });
      const prisma = {
        searchDocument: {
          findMany: vi.fn().mockResolvedValue([{ canonicalId: 'p1', embedding: [1, 0] }]),
        },
      };
      const service = new SemanticSearchService(prisma as never);
      Object.assign(service, { client: { embeddings: { create } } });

      await Promise.all([
        service.search('Cooperative mystery for two'),
        service.search('Cooperative mystery for two'),
      ]);
      await service.search('  cooperative   mystery for TWO  ');

      expect(create).toHaveBeenCalledTimes(1);
      expect(prisma.searchDocument.findMany).toHaveBeenCalledTimes(3);
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});
