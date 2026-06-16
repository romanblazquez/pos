import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterSellerDto {
  @ApiProperty({ type: 'string', description: 'Full legal name or store name', example: 'Acme Board Games' })
  name: string;

  @ApiProperty({ type: 'string', format: 'email', description: 'Seller email — used as login credential', example: 'seller@acme.com' })
  email: string;

  @ApiPropertyOptional({ type: 'string', description: 'Contact phone number', example: '+52 55 1234 5678' })
  phone?: string;

  @ApiPropertyOptional({ type: 'string', description: 'ISO 3166-1 alpha-2 country code', example: 'MX' })
  country?: string;

  @ApiPropertyOptional({ type: 'string', description: 'IANA timezone identifier', example: 'America/Mexico_City' })
  timezone?: string;

  @ApiProperty({ type: 'string', description: 'Login password (min 8 characters)', example: 'S3cur3P@ss!' })
  password: string;
}

export class RegisterCustomerDto {
  @ApiProperty({ type: 'string', description: 'Full name of the buyer', example: 'María García' })
  name: string;

  @ApiProperty({ type: 'string', format: 'email', example: 'maria@example.com' })
  email: string;

  @ApiPropertyOptional({ type: 'string', example: '+52 55 9876 5432' })
  phone?: string;

  @ApiProperty({ type: 'string', example: 'S3cur3P@ss!' })
  password: string;
}

export class LoginDto {
  @ApiProperty({ type: 'string', format: 'email', description: 'Registered email address', example: 'seller@acme.com' })
  email: string;

  @ApiProperty({ type: 'string', example: 'S3cur3P@ss!' })
  password: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: 'string', description: 'JWT bearer token — include as Authorization: Bearer <token> on subsequent requests', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  @ApiPropertyOptional({ type: 'object', description: 'Seller profile (present on seller auth endpoints)' })
  seller?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', description: 'Customer profile (present on customer auth endpoints)' })
  customer?: Record<string, unknown>;
}
