import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail, IsIn, IsOptional, IsString, MinLength, MaxLength,
} from 'class-validator';

export class RegisterSellerDto {
  @ApiProperty({ type: 'string', description: 'Full legal name or store name', example: 'Acme Board Games' })
  @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @ApiProperty({ type: 'string', format: 'email', description: 'Seller email — used as login credential', example: 'seller@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ type: 'string', description: 'Contact phone number', example: '+52 55 1234 5678' })
  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ type: 'string', description: 'ISO 3166-1 alpha-2 country code', example: 'MX' })
  @IsOptional() @IsString() @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ type: 'string', description: 'IANA timezone identifier', example: 'America/Mexico_City' })
  @IsOptional() @IsString() @MaxLength(60)
  timezone?: string;

  @ApiProperty({ type: 'string', description: 'Login password (min 8 characters)', example: 'S3cur3P@ss!' })
  @IsString() @MinLength(8) @MaxLength(128)
  password: string;
}

export class RegisterCustomerDto {
  @ApiProperty({ type: 'string', description: 'Full name of the buyer', example: 'María García' })
  @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @ApiProperty({ type: 'string', format: 'email', example: 'maria@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ type: 'string', example: '+52 55 9876 5432' })
  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @ApiProperty({ type: 'string', example: 'S3cur3P@ss!' })
  @IsString() @MinLength(8) @MaxLength(128)
  password: string;
}

export class LoginDto {
  @ApiProperty({ type: 'string', format: 'email', description: 'Registered email address', example: 'seller@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ type: 'string', example: 'S3cur3P@ss!' })
  @IsString() @MinLength(1)
  password: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: 'string', description: 'JWT bearer token — include as Authorization: Bearer <token> on subsequent requests', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Seller profile (present on seller auth endpoints)' })
  seller?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Customer profile (present on customer auth endpoints)' })
  customer?: Record<string, unknown>;
}

export class GoogleCredentialDto {
  @ApiProperty({ enum: ['marketplace', 'admin', 'seller'] })
  @IsIn(['marketplace', 'admin', 'seller'])
  app: 'marketplace' | 'admin' | 'seller';

  @ApiProperty({ description: 'Google Identity Services ID token' })
  @IsString() @MinLength(20)
  credential: string;

  @ApiProperty({ description: 'One-time state returned by the login challenge endpoint' })
  @IsString() @MinLength(20)
  state: string;
}

export class SessionAppDto {
  @ApiProperty({ enum: ['marketplace', 'admin', 'seller'] })
  @IsIn(['marketplace', 'admin', 'seller'])
  app: 'marketplace' | 'admin' | 'seller';
}
