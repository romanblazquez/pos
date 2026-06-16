import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterSellerDto {
  @ApiProperty({ description: 'Full legal name or store name', example: 'Acme Board Games' })
  name: string;

  @ApiProperty({ description: 'Seller email — used as login credential', example: 'seller@acme.com', format: 'email' })
  email: string;

  @ApiPropertyOptional({ description: 'Contact phone number', example: '+52 55 1234 5678' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Two-letter ISO 3166-1 alpha-2 country code', example: 'MX' })
  country?: string;

  @ApiPropertyOptional({ description: 'IANA timezone identifier', example: 'America/Mexico_City' })
  timezone?: string;

  @ApiProperty({ description: 'Login password (min 8 characters)', example: 'S3cur3P@ss!' })
  password: string;
}

export class RegisterCustomerDto {
  @ApiProperty({ example: 'María García' })
  name: string;

  @ApiProperty({ example: 'maria@example.com', format: 'email' })
  email: string;

  @ApiPropertyOptional({ example: '+52 55 9876 5432' })
  phone?: string;

  @ApiProperty({ example: 'S3cur3P@ss!' })
  password: string;
}

export class LoginDto {
  @ApiProperty({ description: 'Registered email address', example: 'seller@acme.com', format: 'email' })
  email: string;

  @ApiProperty({ example: 'S3cur3P@ss!' })
  password: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT bearer token — pass as Authorization: Bearer <token>', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  @ApiProperty({ description: 'Seller or customer profile included in the token payload' })
  seller?: Record<string, unknown>;

  @ApiProperty()
  customer?: Record<string, unknown>;
}
