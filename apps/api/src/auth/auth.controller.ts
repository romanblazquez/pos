import {
  BadRequestException, Body, Controller, Get, HttpCode, Inject,
  Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  GoogleCredentialDto, LoginDto, RegisterCustomerDto, RegisterSellerDto, SessionAppDto,
} from './auth.dto.js';
import { AuthGuard, Public, Roles } from './auth.guard.js';
import type { JwtPayload } from './jwt.js';
import { GoogleAuthService } from './google-auth.service.js';
import { SessionService, type SessionResponse } from './session.service.js';
import { APP_SECURITY, refreshCookieOptions, type AuthApp } from './auth.constants.js';
import { Throttle } from '@nestjs/throttler';

type AuthRequest = Request & { user: JwtPayload; cookies: Record<string, string | undefined> };

@ApiTags('auth')
@ApiBearerAuth('access-jwt')
@UseGuards(AuthGuard)
@Throttle({ default: { ttl: 60_000, limit: 20 } })
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(GoogleAuthService) private readonly googleAuth: GoogleAuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Public()
  @Get('google/challenge')
  @ApiOperation({ summary: 'Create a one-time Google login nonce and state' })
  googleChallenge(@Query('app') app: string) {
    if (app !== 'marketplace' && app !== 'admin' && app !== 'seller') {
      throw new BadRequestException('Invalid app');
    }
    return this.googleAuth.createChallenge(app);
  }

  @Public()
  @Post('google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify Google identity and create a first-party session' })
  async googleLogin(
    @Body() dto: GoogleCredentialDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identity = await this.googleAuth.authenticate(dto.credential, dto.state, dto.app);
    const session = await this.sessions.create(identity, dto.app, this.metadata(req));
    return this.attachSession(res, dto.app, session);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() dto: SessionAppDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.sessions.rotate(
      req.cookies[APP_SECURITY[dto.app].cookieName] ?? '', dto.app, this.metadata(req),
    );
    return this.attachSession(res, dto.app, session);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body() dto: SessionAppDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookieName = APP_SECURITY[dto.app].cookieName;
    await this.sessions.revoke(req.cookies[cookieName], dto.app);
    res.clearCookie(cookieName, refreshCookieOptions());
  }

  @Public()
  @Post('seller/register')
  async registerSeller(
    @Body() dto: RegisterSellerDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identity = await this.authService.registerSeller(dto);
    const session = await this.sessions.create(identity, 'seller', this.metadata(req));
    return this.attachSession(res, 'seller', session);
  }

  @Public()
  @Post('seller/login')
  @HttpCode(200)
  async loginSeller(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identity = await this.authService.loginSeller(dto);
    const session = await this.sessions.create(identity, 'seller', this.metadata(req));
    return this.attachSession(res, 'seller', session);
  }

  @Get('seller/me')
  @Roles('seller')
  getSellerMe(@Req() req: AuthRequest) {
    return this.authService.getSellerProfile(req.user.sellerId!);
  }

  // Backwards-compatible alias used by the current seller portal.
  @Get('me')
  @Roles('seller')
  getLegacySellerMe(@Req() req: AuthRequest) {
    return this.authService.getSellerProfile(req.user.sellerId!);
  }

  @Post('seller/onboarding')
  @Roles('seller')
  updateOnboarding(
    @Req() req: AuthRequest,
    @Body() body: { step: string; data: Record<string, unknown> },
  ) {
    return this.authService.updateOnboardingStep(req.user.sellerId!, body.step, body.data);
  }

  @Public()
  @Post('customer/register')
  async registerCustomer(
    @Body() dto: RegisterCustomerDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identity = await this.authService.registerCustomer(dto);
    const session = await this.sessions.create(identity, 'marketplace', this.metadata(req));
    return this.attachSession(res, 'marketplace', session);
  }

  @Public()
  @Post('customer/login')
  @HttpCode(200)
  async loginCustomer(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identity = await this.authService.loginCustomer(dto);
    const session = await this.sessions.create(identity, 'marketplace', this.metadata(req));
    return this.attachSession(res, 'marketplace', session);
  }

  @Get('customer/me')
  @Roles('customer')
  async getCustomerMe(@Req() req: AuthRequest) {
    return this.authService.getCustomerProfile(req.user.customerId!);
  }

  private attachSession(res: Response, app: AuthApp, session: SessionResponse) {
    res.cookie(APP_SECURITY[app].cookieName, session.refreshToken, refreshCookieOptions());
    const { refreshToken: _, token, ...publicSession } = session;
    return app === 'seller' ? { ...publicSession, token } : publicSession;
  }

  private metadata(req: Request) {
    return {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    };
  }
}
