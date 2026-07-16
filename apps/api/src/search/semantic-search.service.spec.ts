import { describe, expect, it } from 'vitest';
import { cosine } from './semantic-search.service.js';

describe('semantic vector scoring', () => {
  it('ranks identical vectors above unrelated vectors', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('rejects empty and dimension-mismatched vectors', () => {
    expect(cosine([], [])).toBe(Number.NEGATIVE_INFINITY);
    expect(cosine([1], [1, 2])).toBe(Number.NEGATIVE_INFINITY);
  });
});
