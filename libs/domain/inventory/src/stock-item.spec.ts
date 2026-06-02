import { describe, it, expect } from 'vitest';
import { asId, type ProductId } from '@retail-os/shared-kernel';
import { StockItem } from './stock-item.js';

const pid = asId<'ProductId'>('p1') as ProductId;

describe('StockItem (saga reservation semantics)', () => {
  it('reserves, releases and consumes without overselling', () => {
    const item = new StockItem(pid, 5);
    expect(item.reserve(3).ok).toBe(true);
    expect(item.available).toBe(2);

    expect(item.reserve(3).ok).toBe(false); // would oversell

    item.release(1); // saga compensation
    expect(item.available).toBe(3);

    expect(item.consumeReserved(2).ok).toBe(true);
    expect(item.onHand).toBe(3);
    expect(item.reserved).toBe(0);
  });
});
