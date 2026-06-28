import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@retail-os/db-postgres';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { GoogleAuthService } from './google-auth.service.js';
import { SessionService } from './session.service.js';
import { AuditService } from './audit.service.js';
import { OAuthStateService } from './oauth-state.service.js';
import { SecurityAuditInterceptor } from './security-audit.interceptor.js';
import { AdminBootstrapService } from './admin-bootstrap.service.js';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleAuthService,
    SessionService,
    AuditService,
    OAuthStateService,
    AdminBootstrapService,
    // Register as global guard so every route is protected by default.
    // Mark public routes with @Public() decorator.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: SecurityAuditInterceptor },
  ],
  exports: [AuthService, SessionService, AuditService, OAuthStateService],
})
export class AuthModule {}
