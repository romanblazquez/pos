import { Injectable, Inject, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import type {
  MarketDto, CountryRefDto, CurrencyRefDto, LanguageRefDto,
  TenantMarketDto, CreateTenantMarketDto, UpdateTenantMarketDto,
  SellerMarketDto, CreateSellerMarketDto, UpdateSellerMarketDto,
} from './markets.dto.js';
import {
  DEFAULT_COUNTRY_CODE,
  DEFAULT_CURRENCY_CODE,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_TIMEZONE,
  DEFAULT_TENANT_ID,
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

  /**
   * One active commerce market by code, shaped like MarketDto so the storefront
   * can swap it for the default without branching. Returns null when the market
   * is unknown or inactive — the caller falls back rather than being handed a
   * market that is not open.
   */
  /**
   * The markets a shopper may actually switch between.
   *
   * Distinct from `list()`, which returns every configured country: offering
   * France in a market switcher would let someone select a market we do not
   * trade in, where every product is unbuyable. Only rows the operator has
   * activated appear here.
   */
  async listCommerceMarkets(): Promise<MarketDto[]> {
    try {
      const markets = await this.prisma.commerceMarket.findMany({
        where: { active: true },
        orderBy: { code: 'asc' },
      });
      const symbols = await this.prisma.currency.findMany({
        where: { code: { in: markets.map((m) => m.canonicalCurrency) } },
        select: { code: true, symbol: true },
      });
      const symbolFor = new Map(symbols.map((c) => [c.code, c.symbol]));
      return markets.map((market) => ({
        countryCode: market.countryCode,
        countryName: market.name,
        currencyCode: market.canonicalCurrency,
        currencySymbol: symbolFor.get(market.canonicalCurrency) ?? '$',
        languageCode: market.defaultLanguage,
        timezone: market.timezone,
      }));
    } catch (err) {
      this.logger.warn(`Commerce market list failed: ${String(err)}`);
      return [];
    }
  }

  async getByCode(code: string): Promise<MarketDto | null> {
    try {
      const market = await this.prisma.commerceMarket.findFirst({
        where: { code: code.toUpperCase(), active: true },
      });
      if (!market) return null;
      const currency = await this.prisma.currency.findUnique({
        where: { code: market.canonicalCurrency },
        select: { symbol: true },
      });
      return {
        countryCode: market.countryCode,
        countryName: market.name,
        currencyCode: market.canonicalCurrency,
        currencySymbol: currency?.symbol ?? '$',
        languageCode: market.defaultLanguage,
        timezone: market.timezone,
      };
    } catch (err) {
      this.logger.warn(`Commerce market lookup failed for ${code}: ${String(err)}`);
      return null;
    }
  }

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

  // ─── Reference-data pickers ─────────────────────────────────────────────

  async listCountries(): Promise<CountryRefDto[]> {
    const countries = await this.prisma.country.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    return countries.map((c) => ({ id: c.id, code: c.code, name: c.name }));
  }

  async listCurrencies(): Promise<CurrencyRefDto[]> {
    const currencies = await this.prisma.currency.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
    return currencies.map((c) => ({ id: c.id, code: c.code, name: c.name, symbol: c.symbol }));
  }

  async listLanguages(): Promise<LanguageRefDto[]> {
    const languages = await this.prisma.language.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    return languages.map((l) => ({ id: l.id, code: l.code, name: l.name, nativeName: l.nativeName }));
  }

  private async resolveCountryByCode(countryCode: string) {
    const country = await this.prisma.country.findUnique({ where: { code: countryCode } });
    if (!country) throw new NotFoundException(`Country "${countryCode}" not found`);
    return country;
  }

  // ─── Tenant markets (admin-managed) ────────────────────────────────────

  async listTenantMarkets(tenantId = DEFAULT_TENANT_ID): Promise<TenantMarketDto[]> {
    const rows = await this.prisma.tenantMarket.findMany({
      where: { tenantId },
      include: { country: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      countryCode: r.country.code,
      countryName: r.country.name,
      currencyCode: r.currencyCode,
      defaultLanguageCode: r.defaultLanguageCode,
      timezone: r.timezone,
      active: r.active,
    }));
  }

  async createTenantMarket(dto: CreateTenantMarketDto, tenantId = DEFAULT_TENANT_ID): Promise<TenantMarketDto> {
    const country = await this.resolveCountryByCode(dto.countryCode);
    try {
      const row = await this.prisma.tenantMarket.create({
        data: {
          tenantId,
          countryId: country.id,
          currencyCode: dto.currencyCode,
          defaultLanguageCode: dto.defaultLanguageCode,
          timezone: dto.timezone,
          active: dto.active ?? true,
        },
        include: { country: true },
      });
      return {
        id: row.id,
        countryCode: row.country.code,
        countryName: row.country.name,
        currencyCode: row.currencyCode,
        defaultLanguageCode: row.defaultLanguageCode,
        timezone: row.timezone,
        active: row.active,
      };
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException(`A market for ${dto.countryCode}/${dto.currencyCode}/${dto.defaultLanguageCode} already exists`);
      }
      throw err;
    }
  }

  async updateTenantMarket(id: string, dto: UpdateTenantMarketDto, tenantId = DEFAULT_TENANT_ID): Promise<TenantMarketDto> {
    await this.assertTenantMarketOwnership(id, tenantId);
    const row = await this.prisma.tenantMarket.update({ where: { id }, data: dto, include: { country: true } });
    return {
      id: row.id,
      countryCode: row.country.code,
      countryName: row.country.name,
      currencyCode: row.currencyCode,
      defaultLanguageCode: row.defaultLanguageCode,
      timezone: row.timezone,
      active: row.active,
    };
  }

  async deleteTenantMarket(id: string, tenantId = DEFAULT_TENANT_ID): Promise<void> {
    await this.assertTenantMarketOwnership(id, tenantId);
    await this.prisma.tenantMarket.delete({ where: { id } });
  }

  private async assertTenantMarketOwnership(id: string, tenantId: string) {
    const row = await this.prisma.tenantMarket.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) throw new NotFoundException(`Tenant market "${id}" not found`);
  }

  // ─── Seller markets (seller-managed) ───────────────────────────────────

  async listSellerMarkets(sellerId: string): Promise<SellerMarketDto[]> {
    const rows = await this.prisma.sellerMarket.findMany({
      where: { sellerId },
      include: { country: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toSellerMarketDto(r));
  }

  async createSellerMarket(sellerId: string, dto: CreateSellerMarketDto): Promise<SellerMarketDto> {
    const country = await this.resolveCountryByCode(dto.countryCode);
    try {
      const row = await this.prisma.sellerMarket.create({
        data: {
          sellerId,
          countryId: country.id,
          settlementCurrencyCode: dto.settlementCurrencyCode,
          languageCodes: dto.languageCodes,
          shipsFromCountryCode: dto.shipsFromCountryCode,
          shippingCountries: dto.shippingCountries ?? [],
          localPickup: dto.localPickup ?? false,
          active: dto.active ?? true,
        },
        include: { country: true },
      });
      return this.toSellerMarketDto(row);
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException(`A market for ${dto.countryCode}/${dto.settlementCurrencyCode} already exists for this seller`);
      }
      throw err;
    }
  }

  async updateSellerMarket(sellerId: string, id: string, dto: UpdateSellerMarketDto): Promise<SellerMarketDto> {
    await this.assertSellerMarketOwnership(id, sellerId);
    const row = await this.prisma.sellerMarket.update({ where: { id }, data: dto, include: { country: true } });
    return this.toSellerMarketDto(row);
  }

  async deleteSellerMarket(sellerId: string, id: string): Promise<void> {
    await this.assertSellerMarketOwnership(id, sellerId);
    await this.prisma.sellerMarket.delete({ where: { id } });
  }

  private async assertSellerMarketOwnership(id: string, sellerId: string) {
    const row = await this.prisma.sellerMarket.findUnique({ where: { id } });
    if (!row || row.sellerId !== sellerId) throw new NotFoundException(`Seller market "${id}" not found`);
  }

  private toSellerMarketDto(row: {
    id: string; settlementCurrencyCode: string; languageCodes: string[];
    shipsFromCountryCode: string | null; shippingCountries: string[]; localPickup: boolean; active: boolean;
    country: { code: string; name: string };
  }): SellerMarketDto {
    return {
      id: row.id,
      countryCode: row.country.code,
      countryName: row.country.name,
      settlementCurrencyCode: row.settlementCurrencyCode,
      languageCodes: row.languageCodes,
      shipsFromCountryCode: row.shipsFromCountryCode,
      shippingCountries: row.shippingCountries,
      localPickup: row.localPickup,
      active: row.active,
    };
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return !!err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002';
  }
}
