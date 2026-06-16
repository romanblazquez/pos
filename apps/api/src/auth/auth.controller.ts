import {
  Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService, RegisterSellerDto, RegisterCustomerDto, LoginDto } from './auth.service.js';
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
  registerSeller(@Body() dto: RegisterSellerDto) {
    return this.authService.registerSeller(dto);
  }

  @Public()
  @Post('seller/login')
  @HttpCode(200)
  loginSeller(@Body() dto: LoginDto) {
    return this.authService.loginSeller(dto);
  }

  @Get('me')
  @Roles('seller')
  async getSellerMe(@Req() req: AuthRequest) {
    return this.authService.getSellerProfile(req.user.sub);
  }

  @Post('seller/onboarding')
  @Roles('seller')
  async updateOnboarding(
    @Req() req: AuthRequest,
    @Body() body: { step: string; data: Record<string, unknown> },
  ) {
    return this.authService.updateOnboardingStep(req.user.sub, body.step, body.data);
  }

  // ── Customer auth ──────────────────────────────────────────────────────────

  @Public()
  @Post('customer/register')
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Public()
  @Post('customer/login')
  @HttpCode(200)
  loginCustomer(@Body() dto: LoginDto) {
    return this.authService.loginCustomer(dto);
  }
}
