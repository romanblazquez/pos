import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength,
} from 'class-validator';

export class CreateSellerDto {
  @ApiProperty({ type: 'string', description: 'Full store or business name', example: 'Acme Board Games' })
  @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @ApiProperty({ type: 'string', format: 'email', description: 'Unique seller email', example: 'seller@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ type: 'string', example: '+52 55 1234 5678' })
  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ type: 'string', description: 'ISO 3166-1 alpha-2 country code', example: 'MX', default: 'MX' })
  @IsOptional() @IsString() @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ type: 'string', description: 'IANA timezone', example: 'America/Mexico_City', default: 'America/Mexico_City' })
  @IsOptional() @IsString() @MaxLength(60)
  timezone?: string;

  @ApiPropertyOptional({ type: 'string', description: 'Connector platform: tiendanube | shopify | mercadolibre | woocommerce | csv | manual', example: 'tiendanube' })
  @IsOptional() @IsIn(['tiendanube', 'shopify', 'mercadolibre', 'woocommerce', 'csv', 'manual'])
  connectorType?: string;
}

export class UpdateListingDto {
  @ApiPropertyOptional({ type: 'integer', description: 'Price in minor currency units (centavos). E.g. 150000 = $1,500.00 ARS', example: 150000 })
  @IsOptional() @IsInt() @Min(0)
  priceMinorUnits?: number;

  @ApiPropertyOptional({ type: 'integer', description: 'Stock count. Use 999 for unlimited/unmanaged stock', example: 10 })
  @IsOptional() @IsInt() @Min(0)
  stock?: number;

  @ApiPropertyOptional({ type: 'boolean', description: 'Whether this listing is visible in the marketplace', example: true })
  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class CreateListingDto {
  @ApiProperty({ type: 'string', description: 'Slug of the catalogue product (MktProduct) being listed', example: 'catan' })
  @IsString() @MinLength(1)
  productSlug: string;

  @ApiProperty({ type: 'integer', description: 'Price in minor currency units (centavos). E.g. 150000 = $1,500.00', example: 150000 })
  @IsInt() @Min(1)
  priceMinorUnits: number;

  @ApiPropertyOptional({ type: 'string', description: 'ISO-4217 code. Defaults to the seller\'s configured market currency.', example: 'MXN' })
  @IsOptional() @IsString() @MinLength(3) @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ type: 'integer', description: 'Stock count. Use 999 for unlimited/unmanaged stock', example: 10 })
  @IsOptional() @IsInt() @Min(0)
  stock?: number;

  @ApiPropertyOptional({ enum: ['new', 'used', 'damaged'], example: 'new' })
  @IsOptional() @IsIn(['new', 'used', 'damaged'])
  condition?: string;

  @ApiPropertyOptional({ type: 'string', description: 'Your own SKU. Must be unique within your store.', example: 'SKU-CATAN-01' })
  @IsOptional() @IsString() @MaxLength(120)
  sellerSku?: string;
}

export class BulkUpdateListingsDto {
  @ApiPropertyOptional({ type: [String], description: 'Explicit listing CUIDs to update. Takes precedence over `filter`.' })
  @IsOptional() @IsString({ each: true })
  ids?: string[];

  @ApiPropertyOptional({
    description: 'Used when `ids` is omitted — applies to every listing matching this filter (e.g. select-all-across-pages). An empty filter matches all of the seller\'s listings.',
  })
  @IsOptional()
  filter?: { q?: string; status?: string };

  @ApiProperty({ type: 'boolean', description: 'Whether the matched listings should be visible in the marketplace', example: true })
  @IsBoolean()
  active: boolean;
}

export class ListingStatsDto {
  @ApiProperty({ type: 'integer', description: 'Total listings for this seller', example: 982 })
  total: number;

  @ApiProperty({ type: 'integer', description: 'Listings currently active (visible in marketplace)', example: 910 })
  active: number;

  @ApiProperty({ type: 'integer', description: 'Listings with zero stock', example: 12 })
  outOfStock: number;

  @ApiProperty({ type: 'integer', description: 'Listings with stock ≤ 3 units', example: 18 })
  lowStock: number;
}

export class DayBucketDto {
  @ApiProperty({ type: 'string', format: 'date', description: 'ISO 8601 date', example: '2026-06-09' })
  date: string;

  @ApiProperty({ type: 'integer', description: 'Number of non-cancelled orders on this day', example: 2 })
  orders: number;

  @ApiProperty({ type: 'integer', description: 'Revenue in minor units on this day', example: 120000 })
  revenueMinor: number;
}

export class OrderStatsDto {
  @ApiProperty({ type: 'integer', description: 'Total orders ever placed with this seller', example: 47 })
  total: number;

  @ApiProperty({ type: 'integer', description: 'Orders awaiting payment confirmation', example: 3 })
  pending: number;

  @ApiProperty({ type: 'integer', example: 38 })
  confirmed: number;

  @ApiProperty({ type: 'integer', example: 5 })
  shipped: number;

  @ApiProperty({ type: 'integer', example: 1 })
  cancelled: number;

  @ApiProperty({ type: 'integer', description: 'Cumulative revenue in minor units from non-cancelled orders', example: 4750000 })
  revenueMinorUnits: number;

  @ApiProperty({ type: [DayBucketDto], description: 'Daily revenue and order count for the last 7 days' })
  daily: DayBucketDto[];
}

export class UpdateSellerProfileDto {
  @ApiPropertyOptional({ type: 'string', description: 'Store display name', example: 'Acme Board Games' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ type: 'string', example: '+52 55 1234 5678' })
  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ type: 'string', description: 'IANA timezone', example: 'America/Mexico_City' })
  @IsOptional() @IsString() @MaxLength(60)
  timezone?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ['shipped', 'delivered', 'cancelled'], example: 'shipped' })
  @IsIn(['shipped', 'delivered', 'cancelled'])
  status: 'shipped' | 'delivered' | 'cancelled';

  @ApiPropertyOptional({ type: 'string', example: 'DHL' })
  @IsOptional() @IsString() @MaxLength(60)
  trackingCarrier?: string;

  @ApiPropertyOptional({ type: 'string', example: '1Z999AA10123456784' })
  @IsOptional() @IsString() @MaxLength(120)
  trackingNumber?: string;

  @ApiPropertyOptional({ type: 'string', description: 'Required when cancelling', example: 'Out of stock' })
  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}

export class DeactivateAccountDto {
  @ApiProperty({ type: 'string', description: 'Your current password, to confirm it is really you', example: 'S3cur3P@ss!' })
  @IsString() @MinLength(1)
  currentPassword: string;
}

export class SyncResultDto {
  @ApiProperty({ type: 'string', description: 'Seller CUID', example: 'clx1234abcd' })
  sellerId: string;

  @ApiProperty({ type: 'string', description: 'catalog | inventory | prices', example: 'catalog' })
  syncType: string;

  @ApiProperty({ type: 'string', description: 'success | partial | failed', example: 'success' })
  status: string;

  @ApiProperty({ type: 'integer', description: 'Number of items successfully synced and published into a listing', example: 982 })
  itemsSynced: number;

  @ApiProperty({ type: 'integer', description: 'Number of items staged for seller review — no confident catalog match found', example: 3 })
  itemsStaged: number;

  @ApiProperty({ type: 'integer', description: 'Number of items that failed to sync', example: 0 })
  itemsFailed: number;

  @ApiProperty({ type: 'array', items: { type: 'string' }, description: 'Error messages for failed items', example: [] })
  errors: string[];

  @ApiProperty({ type: 'integer', description: 'Total wall-clock duration of the sync in milliseconds', example: 4231 })
  durationMs: number;
}
