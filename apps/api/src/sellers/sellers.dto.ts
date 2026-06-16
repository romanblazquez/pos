import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSellerDto {
  @ApiProperty({ description: 'Full store or business name', example: 'Acme Board Games' })
  name: string;

  @ApiProperty({ description: 'Unique seller email', example: 'seller@acme.com', format: 'email' })
  email: string;

  @ApiPropertyOptional({ example: '+52 55 1234 5678' })
  phone?: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country code', example: 'MX', default: 'MX' })
  country?: string;

  @ApiPropertyOptional({ description: 'IANA timezone', example: 'America/Mexico_City', default: 'America/Mexico_City' })
  timezone?: string;

  @ApiPropertyOptional({ description: 'Connector platform', example: 'tiendanube', enum: ['tiendanube', 'shopify', 'mercadolibre', 'woocommerce', 'csv', 'manual'] })
  connectorType?: string;
}

export class UpdateListingDto {
  @ApiPropertyOptional({ description: 'New price in minor currency units (centavos). E.g. 150000 = $1,500.00 ARS', example: 150000 })
  priceMinorUnits?: number;

  @ApiPropertyOptional({ description: 'New stock count. Use 999 for unlimited/unmanaged stock', example: 10 })
  stock?: number;

  @ApiPropertyOptional({ description: 'Whether this listing is visible in the marketplace', example: true })
  active?: boolean;
}

export class ListingStatsDto {
  @ApiProperty({ description: 'Total number of listings for this seller', example: 982 })
  total: number;

  @ApiProperty({ description: 'Listings currently active (visible in marketplace)', example: 910 })
  active: number;

  @ApiProperty({ description: 'Listings with zero stock', example: 12 })
  outOfStock: number;

  @ApiProperty({ description: 'Listings with stock ≤ 3 units', example: 18 })
  lowStock: number;
}

export class OrderStatsDto {
  @ApiProperty({ example: 47 })
  total: number;

  @ApiProperty({ description: 'Orders awaiting payment confirmation', example: 3 })
  pending: number;

  @ApiProperty({ example: 38 })
  confirmed: number;

  @ApiProperty({ example: 5 })
  shipped: number;

  @ApiProperty({ example: 1 })
  cancelled: number;

  @ApiProperty({ description: 'Total revenue in minor currency units from non-cancelled orders', example: 4750000 })
  revenueMinorUnits: number;

  @ApiProperty({
    description: 'Daily revenue and order count for the last 7 days',
    example: [{ date: '2026-06-09', orders: 2, revenueMinor: 120000 }],
  })
  daily: { date: string; orders: number; revenueMinor: number }[];
}

export class SyncResultDto {
  @ApiProperty({ example: 'clx1234abcd' })
  sellerId: string;

  @ApiProperty({ example: 'catalog', description: 'catalog | inventory | prices' })
  syncType: string;

  @ApiProperty({ example: 'success', description: 'success | partial | failed' })
  status: string;

  @ApiProperty({ example: 982 })
  itemsSynced: number;

  @ApiProperty({ example: 0 })
  itemsFailed: number;

  @ApiProperty({ type: [String], example: [] })
  errors: string[];

  @ApiProperty({ description: 'Wall-clock time of the sync in milliseconds', example: 4231 })
  durationMs: number;
}
