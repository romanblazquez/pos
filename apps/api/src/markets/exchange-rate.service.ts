import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { Prisma } from '@prisma/client';

/**
 * A converted monetary amount that can always explain itself.
 *
 * Every field needed to reconstruct the conversion travels with the result:
 * which rate was applied, who published it and when it took effect. A price
 * shown to a user months ago must still be explainable from stored data, so
 * conversions never discard their provenance.
 */
export interface ConvertedAmount {
  /** Authoritative seller amount, in the currency the seller actually quoted. */
  nativeMinor: bigint;
  nativeCurrency: string;
  /** Converted amount, or null when no usable rate exists. */
  convertedMinor: bigint | null;
  convertedCurrency: string;
  rate: string | null;
  rateProvider: string | null;
  rateEffectiveAt: Date | null;
  /**
   * False when no rate was found. Callers MUST surface the native amount and
   * label the conversion unavailable rather than inventing a number or
   * silently falling back to 1:1.
   */
  converted: boolean;
}

/** Minor-unit exponents for currencies that are not 2-decimal. */
const MINOR_UNIT_OVERRIDES: Readonly<Record<string, number>> = {
  CLP: 0,
  JPY: 0,
  KRW: 0,
  ISK: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

function minorUnits(currency: string): number {
  return MINOR_UNIT_OVERRIDES[currency.toUpperCase()] ?? 2;
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Most recent rate at or before `asOf`. Never interpolates and never reaches
   * forward in time: a price displayed on a given day must resolve to the rate
   * that was in effect on that day, not one published afterwards.
   */
  async rateFor(
    baseCurrency: string,
    quoteCurrency: string,
    asOf: Date = new Date(),
  ): Promise<{ rate: Prisma.Decimal; provider: string; effectiveAt: Date } | null> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();
    if (base === quote) {
      return { rate: new Prisma.Decimal(1), provider: 'identity', effectiveAt: asOf };
    }

    const direct = await this.prisma.exchangeRateSnapshot.findFirst({
      where: { baseCurrency: base, quoteCurrency: quote, effectiveAt: { lte: asOf } },
      orderBy: { effectiveAt: 'desc' },
      select: { rate: true, provider: true, effectiveAt: true },
    });
    if (direct) return direct;

    // Fall back to the inverse pair. Publishing MXN/USD implies USD/MXN, and
    // requiring both directions to be stored doubles ingestion for no gain.
    const inverse = await this.prisma.exchangeRateSnapshot.findFirst({
      where: { baseCurrency: quote, quoteCurrency: base, effectiveAt: { lte: asOf } },
      orderBy: { effectiveAt: 'desc' },
      select: { rate: true, provider: true, effectiveAt: true },
    });
    if (!inverse || inverse.rate.isZero()) return null;

    return {
      rate: new Prisma.Decimal(1).dividedBy(inverse.rate),
      provider: `${inverse.provider}:inverse`,
      effectiveAt: inverse.effectiveAt,
    };
  }

  /**
   * Convert a minor-unit amount, preserving the native value. Rounds half-up at
   * the target currency's minor-unit precision.
   */
  async convert(
    nativeMinor: bigint,
    nativeCurrency: string,
    targetCurrency: string,
    asOf: Date = new Date(),
  ): Promise<ConvertedAmount> {
    const native = nativeCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();
    const base: ConvertedAmount = {
      nativeMinor,
      nativeCurrency: native,
      convertedMinor: null,
      convertedCurrency: target,
      rate: null,
      rateProvider: null,
      rateEffectiveAt: null,
      converted: false,
    };

    const found = await this.rateFor(native, target, asOf);
    if (!found) {
      this.logger.warn(`No exchange rate for ${native}->${target} as of ${asOf.toISOString()}`);
      return base;
    }

    // Shift between differing minor-unit scales (e.g. MXN 2dp -> CLP 0dp) so the
    // rate applies to real amounts rather than raw minor integers.
    const scale = new Prisma.Decimal(10).pow(minorUnits(target) - minorUnits(native));
    const converted = new Prisma.Decimal(nativeMinor.toString())
      .times(found.rate)
      .times(scale)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

    return {
      ...base,
      convertedMinor: BigInt(converted.toFixed(0)),
      rate: found.rate.toString(),
      rateProvider: found.provider,
      rateEffectiveAt: found.effectiveAt,
      converted: true,
    };
  }

  /**
   * Record a rate observation. Append-only: an identical
   * (base, quote, provider, effectiveAt) is returned as-is rather than updated,
   * so a rate that has already explained a displayed price can never be
   * rewritten underneath it.
   */
  async record(input: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: string | number;
    provider: string;
    effectiveAt: Date;
  }) {
    const baseCurrency = input.baseCurrency.toUpperCase();
    const quoteCurrency = input.quoteCurrency.toUpperCase();
    const existing = await this.prisma.exchangeRateSnapshot.findUnique({
      where: {
        baseCurrency_quoteCurrency_provider_effectiveAt: {
          baseCurrency,
          quoteCurrency,
          provider: input.provider,
          effectiveAt: input.effectiveAt,
        },
      },
    });
    if (existing) return existing;

    return this.prisma.exchangeRateSnapshot.create({
      data: {
        baseCurrency,
        quoteCurrency,
        rate: new Prisma.Decimal(input.rate),
        provider: input.provider,
        effectiveAt: input.effectiveAt,
      },
    });
  }
}
