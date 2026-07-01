import { ApiProperty } from '@nestjs/swagger';

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
