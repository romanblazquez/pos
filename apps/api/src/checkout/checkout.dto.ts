import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty({ description: 'Listing CUID from GET /api/v1/sellers/:id/listings', example: 'clxlisting123' })
  listingId: string;

  @ApiProperty({ description: 'Quantity to purchase (must be ≤ available stock)', example: 1, minimum: 1 })
  quantity: number;
}

export class CheckoutAddressDto {
  @ApiProperty({ example: 'Av. Insurgentes Sur 1234, Piso 5' })
  street: string;

  @ApiProperty({ example: 'Ciudad de México' })
  city: string;

  @ApiPropertyOptional({ example: 'CDMX' })
  state?: string;

  @ApiProperty({ description: 'Postal / ZIP code', example: '03100' })
  postalCode: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2', example: 'MX' })
  country: string;
}

export class InitCheckoutDto {
  @ApiProperty({ type: [CartItemDto], description: 'One or more items to purchase' })
  items: CartItemDto[];

  @ApiProperty({ type: CheckoutAddressDto })
  deliveryAddress: CheckoutAddressDto;

  @ApiPropertyOptional({ description: 'Customer CUID if buyer is authenticated', example: 'clxcustomer456' })
  customerId?: string;
}

export class CheckoutResultDto {
  @ApiProperty({ description: 'Created order CUID', example: 'clxorder789' })
  orderId: string;

  @ApiProperty({ description: 'MercadoPago Checkout Pro URL — redirect the buyer here to complete payment', example: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=...' })
  checkoutUrl: string;

  @ApiProperty({ description: 'Total amount in minor units', example: 350000 })
  totalMinorUnits: number;
}
