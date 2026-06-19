import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsNotEmpty, IsOptional, IsPositive, IsString, IsInt,
  MaxLength, ValidateNested,
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
  @ApiProperty({ type: [CartItemDto], description: 'One or more items to purchase. All must belong to the same seller — MercadoPago marketplace split is a documented 1:1 model (one payment, one seller-collector).' })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiProperty({ type: CheckoutAddressDto, description: 'Shipping address for this order' })
  @ValidateNested() @Type(() => CheckoutAddressDto)
  deliveryAddress: CheckoutAddressDto;

  @ApiPropertyOptional({ type: 'string', description: 'Authenticated customer CUID. Omit for guest checkout.', example: 'clxcustomer456' })
  @IsOptional() @IsString()
  customerId?: string;

  @ApiProperty({ type: 'string', example: 'juan@ejemplo.com' })
  @IsString() @IsNotEmpty()
  customerEmail: string;

  @ApiProperty({ type: 'string', example: 'Juan García' })
  @IsString() @IsNotEmpty()
  customerName: string;

  @ApiProperty({ type: 'string', description: 'Where to redirect the buyer after a successful payment', example: 'https://tienda.com/checkout/success' })
  @IsString() @IsNotEmpty()
  successUrl: string;

  @ApiProperty({ type: 'string', description: 'Where to redirect the buyer after a failed/rejected payment', example: 'https://tienda.com/checkout/failure' })
  @IsString() @IsNotEmpty()
  failureUrl: string;

  @ApiProperty({ type: 'string', description: 'Where to redirect the buyer while payment is still pending', example: 'https://tienda.com/checkout/pending' })
  @IsString() @IsNotEmpty()
  pendingUrl: string;

  @ApiPropertyOptional({ type: 'boolean', description: "Apply as much of the customer's available platform and store credit as possible, capped at the order subtotal. Omit/false to pay the full amount.", example: true })
  @IsOptional() @IsBoolean()
  useCredits?: boolean;
}

export class CheckoutResultDto {
  @ApiProperty({ type: 'string', description: 'Created MarketplaceOrder CUID — use to poll status', example: 'clxorder789' })
  orderId: string;

  @ApiProperty({ type: 'string', description: 'MercadoPago Checkout Pro URL — redirect the buyer here to complete payment', example: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=abc123' })
  checkoutUrl: string;

  @ApiProperty({ type: 'integer', description: 'Order total in minor currency units (centavos)', example: 350000 })
  totalMinorUnits: number;
}
