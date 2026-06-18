import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsNotEmpty, IsOptional, IsPositive, IsString, IsInt,
  MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CartItemDto {
  @ApiProperty({ type: 'string', description: 'Listing CUID — from GET /api/v1/sellers/:id/listings', example: 'clxlisting123' })
  @IsString() @IsNotEmpty()
  listingId: string;

  @ApiProperty({ type: 'integer', description: 'Units to purchase. Must be ≤ available stock', example: 1, minimum: 1 })
  @IsInt() @IsPositive()
  quantity: number;
}

export class CheckoutAddressDto {
  @ApiProperty({ type: 'string', description: 'Street address including number and floor', example: 'Av. Insurgentes Sur 1234, Piso 5' })
  @IsString() @IsNotEmpty() @MaxLength(200)
  street: string;

  @ApiProperty({ type: 'string', example: 'Ciudad de México' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ type: 'string', description: 'State or province', example: 'CDMX' })
  @IsOptional() @IsString() @MaxLength(100)
  state?: string;

  @ApiProperty({ type: 'string', description: 'Postal or ZIP code', example: '03100' })
  @IsString() @IsNotEmpty() @MaxLength(20)
  postalCode: string;

  @ApiProperty({ type: 'string', description: 'ISO 3166-1 alpha-2 country code', example: 'MX' })
  @IsString() @IsNotEmpty() @MaxLength(2)
  country: string;
}

export class InitCheckoutDto {
  @ApiProperty({ type: [CartItemDto], description: 'One or more items to purchase. All must belong to the same seller.' })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiProperty({ type: CheckoutAddressDto, description: 'Shipping address for this order' })
  @ValidateNested() @Type(() => CheckoutAddressDto)
  deliveryAddress: CheckoutAddressDto;

  @ApiPropertyOptional({ type: 'string', description: 'Authenticated customer CUID. Omit for guest checkout.', example: 'clxcustomer456' })
  @IsOptional() @IsString()
  customerId?: string;

  @ApiPropertyOptional({ type: 'integer', description: 'Platform wallet credits to apply, in minor currency units. Capped at what the customer actually has and at the order subtotal.', example: 5000 })
  @IsOptional() @IsInt() @Min(0)
  platformCreditsToUse?: number;

  @ApiPropertyOptional({ type: 'integer', description: "Seller-specific store credits to apply, in minor currency units. Capped at the customer's balance for this seller and at the order subtotal.", example: 0 })
  @IsOptional() @IsInt() @Min(0)
  storeCreditsToUse?: number;
}

export class CheckoutResultDto {
  @ApiProperty({ type: 'string', description: 'Created MarketplaceOrder CUID — use to poll status', example: 'clxorder789' })
  orderId: string;

  @ApiProperty({ type: 'string', description: 'MercadoPago Checkout Pro URL — redirect the buyer here to complete payment', example: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=abc123' })
  checkoutUrl: string;

  @ApiProperty({ type: 'integer', description: 'Order total in minor currency units (centavos)', example: 350000 })
  totalMinorUnits: number;
}
