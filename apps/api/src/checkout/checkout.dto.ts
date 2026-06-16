import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty({ type: 'string', description: 'Listing CUID — from GET /api/v1/sellers/:id/listings', example: 'clxlisting123' })
  listingId: string;

  @ApiProperty({ type: 'integer', description: 'Units to purchase. Must be ≤ available stock', example: 1, minimum: 1 })
  quantity: number;
}

export class CheckoutAddressDto {
  @ApiProperty({ type: 'string', description: 'Street address including number and floor', example: 'Av. Insurgentes Sur 1234, Piso 5' })
  street: string;

  @ApiProperty({ type: 'string', example: 'Ciudad de México' })
  city: string;

  @ApiPropertyOptional({ type: 'string', description: 'State or province', example: 'CDMX' })
  state?: string;

  @ApiProperty({ type: 'string', description: 'Postal or ZIP code', example: '03100' })
  postalCode: string;

  @ApiProperty({ type: 'string', description: 'ISO 3166-1 alpha-2 country code', example: 'MX' })
  country: string;
}

export class InitCheckoutDto {
  @ApiProperty({ type: [CartItemDto], description: 'One or more items to purchase. All must belong to the same seller.' })
  items: CartItemDto[];

  @ApiProperty({ type: CheckoutAddressDto, description: 'Shipping address for this order' })
  deliveryAddress: CheckoutAddressDto;

  @ApiPropertyOptional({ type: 'string', description: 'Authenticated customer CUID. Omit for guest checkout.', example: 'clxcustomer456' })
  customerId?: string;
}

export class CheckoutResultDto {
  @ApiProperty({ type: 'string', description: 'Created MarketplaceOrder CUID — use to poll status', example: 'clxorder789' })
  orderId: string;

  @ApiProperty({ type: 'string', description: 'MercadoPago Checkout Pro URL — redirect the buyer here to complete payment', example: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=abc123' })
  checkoutUrl: string;

  @ApiProperty({ type: 'integer', description: 'Order total in minor currency units (centavos)', example: 350000 })
  totalMinorUnits: number;
}
