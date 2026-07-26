import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { MarketsService } from './markets.service.js';
import { MarketDto, CountryRefDto, CurrencyRefDto, LanguageRefDto } from './markets.dto.js';
import { Public } from '../auth/auth.guard.js';

@ApiTags('markets')
@Public()
@Controller('api/v1/markets')
export class MarketsController {
  constructor(@Inject(MarketsService) private readonly svc: MarketsService) {}

  @Get()
  @ApiOperation({ summary: 'List active countries/currencies/languages for market pickers' })
  @ApiOkResponse({ type: MarketDto, isArray: true })
  list(): Promise<MarketDto[]> {
    return this.svc.list();
  }

  @Get('default')
  @ApiOperation({ summary: "The platform's default market (falls back to MX/MXN/es if unseeded)" })
  @ApiOkResponse({ type: MarketDto })
  getDefault(): Promise<MarketDto> {
    return this.svc.getDefault();
  }

  // Raw reference-data lists, for the tenant/seller market CRUD form pickers —
  // distinct from list() above, which bundles each country with its single
  // default currency/language rather than every option.
  @Get('countries')
  @ApiOperation({ summary: 'Raw list of active countries, for market-form pickers' })
  @ApiOkResponse({ type: CountryRefDto, isArray: true })
  listCountries(): Promise<CountryRefDto[]> {
    return this.svc.listCountries();
  }

  @Get('currencies')
  @ApiOperation({ summary: 'Raw list of active currencies, for market-form pickers' })
  @ApiOkResponse({ type: CurrencyRefDto, isArray: true })
  listCurrencies(): Promise<CurrencyRefDto[]> {
    return this.svc.listCurrencies();
  }

  @Get('languages')
  @ApiOperation({ summary: 'Raw list of active languages, for market-form pickers' })
  @ApiOkResponse({ type: LanguageRefDto, isArray: true })
  listLanguages(): Promise<LanguageRefDto[]> {
    return this.svc.listLanguages();
  }

  // Declared LAST: a ':code' route placed above 'default'/'countries' would
  // swallow them, and the failure would look like a missing market rather than
  // a routing mistake.
  @Get(':code')
  @ApiOperation({ summary: 'One active commerce market by code (MX, AR)' })
  @ApiOkResponse({ type: MarketDto })
  async getByCode(@Param('code') code: string): Promise<MarketDto> {
    const market = await this.svc.getByCode(code);
    if (!market) throw new NotFoundException(`Market "${code}" not found or inactive`);
    return market;
  }
}
