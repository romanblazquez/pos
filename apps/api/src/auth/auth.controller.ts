import {
  Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import {
  RegisterSellerDto, RegisterCustomerDto, LoginDto, AuthResponseDto,
} from './auth.dto.js';
import { AuthGuard, Public, Roles } from './auth.guard.js';
import type { JwtPayload } from './jwt.js';

type AuthRequest = Request & { user: JwtPayload };

@ApiTags('auth')
@ApiBearerAuth('seller-jwt')
@UseGuards(AuthGuard)
@Controller('api/v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  // ── Seller auth ────────────────────────────────────────────────────────────

  @Public()
  @Post('seller/register')
  @ApiOperation({
    summary: 'Register a new seller',
    description: 'Creates a new seller account and returns a JWT bearer token. Returns 409 if the email is already in use.',
  })
  @ApiBody({ type: RegisterSellerDto })
  @ApiResponse({ status: 201, description: 'Seller registered — returns token and seller profile.', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
  registerSeller(@Body() dto: RegisterSellerDto) {
    return this.authService.registerSeller(dto);
  }

  @Public()
  @Post('seller/login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Seller login',
    description: 'Authenticates a seller by email and password. Returns a JWT bearer token on success.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful — returns token and seller profile.', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  loginSeller(@Body() dto: LoginDto) {
    return this.authService.loginSeller(dto);
  }

  @Get('me')
  @Roles('seller')
  @ApiOperation({
    summary: 'Get current seller profile',
    description: 'Returns the authenticated seller\'s profile. Requires a valid seller JWT passed as `Authorization: Bearer <token>`.',
  })
  @ApiResponse({ status: 200, description: 'Authenticated seller profile object.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid bearer token.' })
  async getSellerMe(@Req() req: AuthRequest) {
    return this.authService.getSellerProfile(req.user.sub);
  }

  @Post('seller/onboarding')
  @Roles('seller')
  @ApiOperation({
    summary: 'Update seller onboarding step',
    description: 'Records progress through the seller onboarding flow. Call once per step with the step identifier and any associated data collected in that step.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['step', 'data'],
      properties: {
        step: {
          type: 'string',
          description: 'Onboarding step identifier',
          example: 'store_details',
        },
        data: {
          type: 'object',
          description: 'Arbitrary key-value pairs collected in this step',
          example: { storeName: 'Acme Board Games', country: 'MX' },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated seller record after applying the onboarding step.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid bearer token.' })
  async updateOnboarding(
    @Req() req: AuthRequest,
    @Body() body: { step: string; data: Record<string, unknown> },
  ) {
    return this.authService.updateOnboardingStep(req.user.sub, body.step, body.data);
  }

  // ── Customer auth ──────────────────────────────────────────────────────────

  @Public()
  @Post('customer/register')
  @ApiOperation({
    summary: 'Register a new customer',
    description: 'Creates a new buyer account. Returns a JWT bearer token for subsequent authenticated requests.',
  })
  @ApiBody({ type: RegisterCustomerDto })
  @ApiResponse({ status: 201, description: 'Customer registered — returns token and customer profile.', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Public()
  @Post('customer/login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Customer login',
    description: 'Authenticates a buyer by email and password. Returns a JWT bearer token on success.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful — returns token and customer profile.', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  loginCustomer(@Body() dto: LoginDto) {
    return this.authService.loginCustomer(dto);
  }
}
