import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import type { MarketDto } from './markets.dto.js';
import {
  DEFAULT_COUNTRY_CODE,
  DEFAULT_CURRENCY_CODE,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_TIMEZONE,
} from './default-market.constants.js';

const FALLBACK_MARKET: MarketDto = {
  countryCode: DEFAULT_COUNTRY_CODE,
  countryName: 'México',
  currencyCode: DEFAULT_CURRENCY_CODE,
  currencySymbol: '$',
  languageCode: DEFAULT_LANGUAGE_CODE,
  timezone: DEFAULT_TIMEZONE,
};

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** All active countries, for market/language pickers. */
  async list(): Promise<MarketDto[]> {
    let countries: Awaited<ReturnType<PrismaService['country']['findMany']>>;
    try {
      countries = await this.prisma.country.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      });
    } catch (err) {
      // The country/currency/language reference tables are additive per the
      // schema (docs/architecture/juegospedia-next-generation.md) and may not
      // be migrated on every environment yet — degrade to the single default
      // market instead of failing the request.
      this.logger.warn(`Falling back to default market list: ${String(err)}`);
      return [FALLBACK_MARKET];
    }

    if (countries.length === 0) return [FALLBACK_MARKET];

    const currencyCodes = [...new Set(countries.map((c) => c.defaultCurrency).filter((c): c is string => !!c))];
    const currencies = currencyCodes.length
      ? await this.prisma.currency.findMany({ where: { code: { in: currencyCodes } } })
      : [];
    const currencyByCode = new Map(currencies.map((c) => [c.code, c]));

    return countries.map((country) => ({
      countryCode: country.code,
      countryName: country.name,
      currencyCode: country.defaultCurrency ?? DEFAULT_CURRENCY_CODE,
      currencySymbol: currencyByCode.get(country.defaultCurrency ?? '')?.symbol ?? '$',
      languageCode: country.defaultLanguage ?? DEFAULT_LANGUAGE_CODE,
      timezone: country.timezone ?? DEFAULT_TIMEZONE,
    }));
  }

  /**
   * The platform default market — MX/MXN/es today. Falls back to the hardcoded
   * constants if the Country/Currency reference tables aren't migrated or the
   * MX row hasn't been seeded yet, so callers never fail just because the
   * market tables are empty (see apps/api/scripts/seed-default-market.ts).
   */
  async getDefault(): Promise<MarketDto> {
    let country: Awaited<ReturnType<PrismaService['country']['findUnique']>>;
    try {
      country = await this.prisma.country.findUnique({ where: { code: DEFAULT_COUNTRY_CODE } });
    } catch (err) {
      this.logger.warn(`Falling back to default market: ${String(err)}`);
      return FALLBACK_MARKET;
    }
    if (!country) return FALLBACK_MARKET;

    const currency = country.defaultCurrency
      ? await this.prisma.currency.findUnique({ where: { code: country.defaultCurrency } })
      : null;

    return {
      countryCode: country.code,
      countryName: country.name,
      currencyCode: country.defaultCurrency ?? DEFAULT_CURRENCY_CODE,
      currencySymbol: currency?.symbol ?? '$',
      languageCode: country.defaultLanguage ?? DEFAULT_LANGUAGE_CODE,
      timezone: country.timezone ?? DEFAULT_TIMEZONE,
    };
  }
}
