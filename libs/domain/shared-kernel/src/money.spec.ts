import { describe, it, expect } from 'vitest';
import { Money } from './money.js';

describe('Money', () => {
  it('builds from decimal without float drift', () => {
    expect(Money.fromDecimal(19.99, 'MXN').minorUnits).toBe(1999);
    expect(Money.fromDecimal(0.1, 'MXN').add(Money.fromDecimal(0.2, 'MXN')).minorUnits).toBe(30);
  });

  it('adds and subtracts in minor units', () => {
    const a = Money.of(1500, 'MXN');
    const b = Money.of(250, 'MXN');
    expect(a.add(b).minorUnits).toBe(1750);
    expect(a.subtract(b).minorUnits).toBe(1250);
  });

  it('multiplies by quantity with half-up rounding', () => {
    expect(Money.of(333, 'MXN').multiply(3).minorUnits).toBe(999);
    expect(Money.of(100, 'MXN').multiply(0.155).minorUnits).toBe(16);
  });

  it('computes percentage (e.g. 16% IVA)', () => {
    expect(Money.of(10000, 'MXN').percentage(16).minorUnits).toBe(1600);
  });

  it('clamps negative results to zero', () => {
    expect(Money.of(500, 'MXN').subtract(Money.of(800, 'MXN')).clampToZero().minorUnits).toBe(0);
  });

  it('rejects cross-currency arithmetic', () => {
    expect(() => Money.of(100, 'MXN').add(Money.of(100, 'USD'))).toThrow(/Currency mismatch/);
  });

  it('sums a list', () => {
    const total = Money.sum([Money.of(100, 'MXN'), Money.of(250, 'MXN'), Money.of(50, 'MXN')], 'MXN');
    expect(total.minorUnits).toBe(400);
  });
});
