import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class MarketDto {
  @ApiProperty({ type: 'string', description: 'ISO 3166-1 alpha-2 country code', example: 'MX' })
  countryCode: string;

  @ApiProperty({ type: 'string', description: 'Country display name', example: 'México' })
  countryName: string;

  @ApiProperty({ type: 'string', description: 'ISO 4217 currency code', example: 'MXN' })
  currencyCode: string;

  @ApiProperty({ type: 'string', description: 'Currency symbol', example: '$' })
  currencySymbol: string;

  @ApiProperty({ type: 'string', description: 'Default language code for this market', example: 'es' })
  languageCode: string;

  @ApiProperty({ type: 'string', description: 'IANA timezone', example: 'America/Mexico_City' })
  timezone: string;
}

// ─── Reference-data pickers (countries/currencies/languages) ────────────────

export class CountryRefDto {
  @ApiProperty({ type: 'string' }) id: string;
  @ApiProperty({ type: 'string', example: 'MX' }) code: string;
  @ApiProperty({ type: 'string', example: 'México' }) name: string;
}

export class CurrencyRefDto {
  @ApiProperty({ type: 'string' }) id: string;
  @ApiProperty({ type: 'string', example: 'MXN' }) code: string;
  @ApiProperty({ type: 'string', example: 'Peso mexicano' }) name: string;
  @ApiProperty({ type: 'string', example: '$' }) symbol: string;
}

export class LanguageRefDto {
  @ApiProperty({ type: 'string' }) id: string;
  @ApiProperty({ type: 'string', example: 'es-MX' }) code: string;
  @ApiProperty({ type: 'string', example: 'Spanish (Mexico)' }) name: string;
  @ApiProperty({ type: 'string', example: 'Español (México)' }) nativeName: string;
}

// ─── Tenant markets (admin-managed) ──────────────────────────────────────────

export class TenantMarketDto {
  @ApiProperty({ type: 'string' }) id: string;
  @ApiProperty({ type: 'string', example: 'MX' }) countryCode: string;
  @ApiProperty({ type: 'string', example: 'México' }) countryName: string;
  @ApiProperty({ type: 'string', example: 'MXN' }) currencyCode: string;
  @ApiProperty({ type: 'string', example: 'es-MX' }) defaultLanguageCode: string;
  @ApiProperty({ type: 'string', example: 'America/Mexico_City' }) timezone: string;
  @ApiProperty({ type: 'boolean' }) active: boolean;
}

export class CreateTenantMarketDto {
  @ApiProperty({ type: 'string', description: 'ISO 3166-1 alpha-2 country code', example: 'MX' })
  @IsString() @Length(2, 2)
  countryCode: string;

  @ApiProperty({ type: 'string', description: 'ISO 4217 currency code', example: 'MXN' })
  @IsString() @Length(3, 3)
  currencyCode: string;

  @ApiProperty({ type: 'string', description: 'Default language code', example: 'es-MX' })
  @IsString()
  defaultLanguageCode: string;

  @ApiProperty({ type: 'string', description: 'IANA timezone', example: 'America/Mexico_City' })
  @IsString()
  timezone: string;

  @ApiPropertyOptional({ type: 'boolean', default: true })
  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdateTenantMarketDto {
  @ApiPropertyOptional({ type: 'string', example: 'MXN' })
  @IsOptional() @IsString() @Length(3, 3)
  currencyCode?: string;

  @ApiPropertyOptional({ type: 'string', example: 'es-MX' })
  @IsOptional() @IsString()
  defaultLanguageCode?: string;

  @ApiPropertyOptional({ type: 'string', example: 'America/Mexico_City' })
  @IsOptional() @IsString()
  timezone?: string;

  @ApiPropertyOptional({ type: 'boolean' })
  @IsOptional() @IsBoolean()
  active?: boolean;
}

// ─── Seller markets (seller-managed) ─────────────────────────────────────────

export class SellerMarketDto {
  @ApiProperty({ type: 'string' }) id: string;
  @ApiProperty({ type: 'string', example: 'MX' }) countryCode: string;
  @ApiProperty({ type: 'string', example: 'México' }) countryName: string;
  @ApiProperty({ type: 'string', example: 'MXN' }) settlementCurrencyCode: string;
  @ApiProperty({ type: 'string', isArray: true, example: ['es-MX'] }) languageCodes: string[];
  @ApiPropertyOptional({ type: 'string', example: 'MX' }) shipsFromCountryCode?: string | null;
  @ApiProperty({ type: 'string', isArray: true, example: ['MX'] }) shippingCountries: string[];
  @ApiProperty({ type: 'boolean' }) localPickup: boolean;
  @ApiProperty({ type: 'boolean' }) active: boolean;
}

export class CreateSellerMarketDto {
  @ApiProperty({ type: 'string', description: 'ISO 3166-1 alpha-2 country code', example: 'MX' })
  @IsString() @Length(2, 2)
  countryCode: string;

  @ApiProperty({ type: 'string', description: 'ISO 4217 settlement currency code', example: 'MXN' })
  @IsString() @Length(3, 3)
  settlementCurrencyCode: string;

  @ApiProperty({ type: 'string', isArray: true, description: 'Languages this seller supports in this market', example: ['es-MX'] })
  @IsArray() @IsString({ each: true })
  languageCodes: string[];

  @ApiPropertyOptional({ type: 'string', description: 'Country the seller ships from, if different', example: 'MX' })
  @IsOptional() @IsString() @Length(2, 2)
  shipsFromCountryCode?: string;

  @ApiPropertyOptional({ type: 'string', isArray: true, description: 'Countries this seller will ship to', example: ['MX'] })
  @IsOptional() @IsArray() @IsString({ each: true })
  shippingCountries?: string[];

  @ApiPropertyOptional({ type: 'boolean', default: false })
  @IsOptional() @IsBoolean()
  localPickup?: boolean;

  @ApiPropertyOptional({ type: 'boolean', default: true })
  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdateSellerMarketDto {
  @ApiPropertyOptional({ type: 'string', example: 'MXN' })
  @IsOptional() @IsString() @Length(3, 3)
  settlementCurrencyCode?: string;

  @ApiPropertyOptional({ type: 'string', isArray: true, example: ['es-MX'] })
  @IsOptional() @IsArray() @IsString({ each: true })
  languageCodes?: string[];

  @ApiPropertyOptional({ type: 'string', example: 'MX' })
  @IsOptional() @IsString() @Length(2, 2)
  shipsFromCountryCode?: string;

  @ApiPropertyOptional({ type: 'string', isArray: true, example: ['MX'] })
  @IsOptional() @IsArray() @IsString({ each: true })
  shippingCountries?: string[];

  @ApiPropertyOptional({ type: 'boolean' })
  @IsOptional() @IsBoolean()
  localPickup?: boolean;

  @ApiPropertyOptional({ type: 'boolean' })
  @IsOptional() @IsBoolean()
  active?: boolean;
}
