import {
  BadRequestException, Body, Controller, Get, HttpCode, Inject,
  Patch, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto, GoogleCredentialDto, LoginDto, RegisterCustomerDto, RegisterSellerDto, SessionAppDto,
} from './auth.dto.js';
import { AuthGuard, Public, Roles } from './auth.guard.js';
import type { JwtPayload } from './jwt.js';
import { GoogleAuthService } from './google-auth.service.js';
import { SessionService, type SessionResponse } from './session.service.js';
import { AuditService } from './audit.service.js';
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
    @Inject(AuditService) private readonly audit: AuditService,
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

  @Patch('seller/password')
  @Roles('seller')
  @ApiOperation({
    summary: 'Change your own seller password',
    description:
      'Requires the current password even though the caller is authenticated — a live session can be a stolen token, ' +
      'and proving knowledge of the existing password is what makes this a lockout rather than another use of it. ' +
      'On success every OTHER session family is revoked, so other devices are signed out; the calling session survives.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: '{ ok: true, otherSessionsRevoked: number }' })
  @ApiResponse({ status: 400, description: 'Google-only account, or the new password matches the old one' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changeSellerPassword(@Req() req: AuthRequest, @Body() dto: ChangePasswordDto) {
    try {
      const result = await this.authService.changeSellerPassword(
        req.user.sellerId!, req.user.sub, req.user.sid, dto,
      );
      await this.audit.write({
        actorPrincipalId: req.user.sub,
        sessionId: req.user.sid,
        action: 'auth.password.changed',
        targetType: 'seller',
        targetId: req.user.sellerId!,
        outcome: 'success',
        metadata: { otherSessionsRevoked: result.otherSessionsRevoked },
      });
      return result;
    } catch (err) {
      // A failed attempt is the signal worth keeping: it is what a brute-force
      // or a probing session looks like in the audit log.
      await this.audit.write({
        actorPrincipalId: req.user.sub,
        sessionId: req.user.sid,
        action: 'auth.password.changed',
        targetType: 'seller',
        targetId: req.user.sellerId!,
        outcome: 'failure',
      }).catch(() => undefined);
      throw err;
    }
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
