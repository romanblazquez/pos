import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { ExchangeRateService } from './exchange-rate.service.js';

const AS_OF = new Date('2026-07-26T00:00:00.000Z');

/** Prisma double returning fixed snapshot rows, with call capture for assertions. */
function prismaWith(rows: Array<{
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  provider: string;
  effectiveAt: Date;
}>) {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    client: {
      exchangeRateSnapshot: {
        findFirst: async (args: any) => {
          calls.push(args.where);
          const match = rows
            .filter(
              (row) =>
                row.baseCurrency === args.where.baseCurrency &&
                row.quoteCurrency === args.where.quoteCurrency &&
                row.effectiveAt <= args.where.effectiveAt.lte,
            )
            .sort((a, b) => b.effectiveAt.getTime() - a.effectiveAt.getTime())[0];
          return match
            ? { rate: new Prisma.Decimal(match.rate), provider: match.provider, effectiveAt: match.effectiveAt }
            : null;
        },
      },
    } as never,
  };
}

describe('ExchangeRateService', () => {
  it('converts using the most recent rate at or before the requested time', async () => {
    const { client } = prismaWith([
      { baseCurrency: 'USD', quoteCurrency: 'MXN', rate: '17.0', provider: 'ecb', effectiveAt: new Date('2026-07-20T00:00:00Z') },
      { baseCurrency: 'USD', quoteCurrency: 'MXN', rate: '18.5', provider: 'ecb', effectiveAt: new Date('2026-07-25T00:00:00Z') },
    ]);
    const service = new ExchangeRateService(client);

    const result = await service.convert(10_000n, 'USD', 'MXN', AS_OF);

    expect(result.converted).toBe(true);
    expect(result.convertedMinor).toBe(185_000n);
    expect(result.rate).toBe('18.5');
    expect(result.rateEffectiveAt).toEqual(new Date('2026-07-25T00:00:00Z'));
    // The authoritative seller amount survives conversion untouched.
    expect(result.nativeMinor).toBe(10_000n);
    expect(result.nativeCurrency).toBe('USD');
  });

  it('never reaches forward in time for a rate published after the price was shown', async () => {
    const { client } = prismaWith([
      { baseCurrency: 'USD', quoteCurrency: 'MXN', rate: '17.0', provider: 'ecb', effectiveAt: new Date('2026-07-20T00:00:00Z') },
      { baseCurrency: 'USD', quoteCurrency: 'MXN', rate: '99.0', provider: 'ecb', effectiveAt: new Date('2026-07-30T00:00:00Z') },
    ]);
    const service = new ExchangeRateService(client);

    const result = await service.convert(1_000n, 'USD', 'MXN', new Date('2026-07-22T00:00:00Z'));

    expect(result.rate).toBe('17');
    expect(result.convertedMinor).toBe(17_000n);
  });

  it('reports failure instead of inventing a rate when none exists', async () => {
    const { client } = prismaWith([]);
    const service = new ExchangeRateService(client);

    const result = await service.convert(5_000n, 'USD', 'ARS', AS_OF);

    expect(result.converted).toBe(false);
    expect(result.convertedMinor).toBeNull();
    expect(result.rate).toBeNull();
    // A failed conversion must still carry the native amount so the caller can
    // show the real seller price rather than nothing — or worse, a 1:1 fake.
    expect(result.nativeMinor).toBe(5_000n);
    expect(result.nativeCurrency).toBe('USD');
  });

  it('derives the inverse pair rather than requiring both directions to be stored', async () => {
    const { client } = prismaWith([
      { baseCurrency: 'USD', quoteCurrency: 'MXN', rate: '20.0', provider: 'ecb', effectiveAt: new Date('2026-07-25T00:00:00Z') },
    ]);
    const service = new ExchangeRateService(client);

    const result = await service.convert(20_000n, 'MXN', 'USD', AS_OF);

    expect(result.converted).toBe(true);
    expect(result.convertedMinor).toBe(1_000n);
    expect(result.rateProvider).toBe('ecb:inverse');
  });

  it('is an identity conversion for a single currency without hitting storage', async () => {
    const { client, calls } = prismaWith([]);
    const service = new ExchangeRateService(client);

    const result = await service.convert(1_234n, 'MXN', 'MXN', AS_OF);

    expect(result.converted).toBe(true);
    expect(result.convertedMinor).toBe(1_234n);
    expect(calls).toHaveLength(0);
  });

  it('rescales between currencies with different minor units', async () => {
    const { client } = prismaWith([
      { baseCurrency: 'MXN', quoteCurrency: 'CLP', rate: '50.0', provider: 'ecb', effectiveAt: new Date('2026-07-25T00:00:00Z') },
    ]);
    const service = new ExchangeRateService(client);

    // 100.00 MXN (2dp) at 50 CLP/MXN = 5000 CLP, which is 5000 minor units (0dp).
    const result = await service.convert(10_000n, 'MXN', 'CLP', AS_OF);

    expect(result.convertedMinor).toBe(5_000n);
  });

  it('rounds half-up at the target currency precision', async () => {
    const { client } = prismaWith([
      { baseCurrency: 'USD', quoteCurrency: 'MXN', rate: '18.005', provider: 'ecb', effectiveAt: new Date('2026-07-25T00:00:00Z') },
    ]);
    const service = new ExchangeRateService(client);

    // 1.00 USD * 18.005 = 18.005 MXN -> 1800.5 minor -> 1801.
    const result = await service.convert(100n, 'USD', 'MXN', AS_OF);

    expect(result.convertedMinor).toBe(1_801n);
  });
});
