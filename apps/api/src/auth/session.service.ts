import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { APP_SECURITY, type AuthApp } from './auth.constants.js';
import { signToken, type TokenRole } from './jwt.js';
import { AuditService } from './audit.service.js';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

class ConcurrentRefreshReuseError extends Error {}

// Only these fields are ever safe to send to the browser as part of a
// session — never the raw Prisma row (which includes passwordHash,
// connectorConfig, verifyToken, etc.). Both the login/register path
// (auth.service.ts) and the refresh path (identityFromSession below) must
// go through these, so a session can never leak more than this shape
// regardless of which path produced it.
export interface PublicSeller {
  id: string; name: string; slug: string; email: string; status: string; tier: string;
  connectorType: string | null; onboardingStep: string | null; emailVerified: boolean;
}
export interface PublicCustomer {
  id: string; email: string; name?: string | null;
}

export function publicSeller(s: {
  id: string; name: string; slug: string; email: string; status: string; tier: string;
  connectorType: string | null; onboardingStep: string | null; emailVerified: boolean;
}): PublicSeller {
  return {
    id: s.id, name: s.name, slug: s.slug, email: s.email, status: s.status, tier: s.tier,
    connectorType: s.connectorType, onboardingStep: s.onboardingStep, emailVerified: s.emailVerified,
  };
}

export function publicCustomer(c: { id: string; email: string; name?: string | null }): PublicCustomer {
  return { id: c.id, email: c.email, name: c.name };
}

export interface SessionIdentity {
  principalId: string;
  email: string;
  name?: string | null;
  role: TokenRole;
  customer?: PublicCustomer;
  seller?: PublicSeller;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionResponse {
  accessToken: string;
  token: string;
  expiresIn: number;
  user: { id: string; email: string; name?: string | null; role: TokenRole };
  customer?: SessionIdentity['customer'];
  seller?: SessionIdentity['seller'];
  refreshToken: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(identity: SessionIdentity, app: AuthApp, metadata: SessionMetadata): Promise<SessionResponse> {
    const policy = APP_SECURITY[app];
    if (policy.role !== identity.role) throw new UnauthorizedException('Invalid application role');

    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.prisma.authSession.create({
      data: {
        principalId: identity.principalId,
        familyId: randomUUID(),
        role: identity.role,
        audience: policy.audience,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        userAgent: metadata.userAgent?.slice(0, 500),
        ipAddress: metadata.ipAddress?.slice(0, 64),
      },
    });
    await this.audit.write({
      actorPrincipalId: identity.principalId,
      sessionId: session.id,
      action: 'auth.session.created',
      ipAddress: metadata.ipAddress,
      metadata: { app, role: identity.role },
    });
    return this.response(identity, app, session.id, refreshToken);
  }

  async rotate(refreshToken: string, app: AuthApp, metadata: SessionMetadata): Promise<SessionResponse> {
    const tokenHash = hashToken(refreshToken);
    const current = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        principal: {
          include: { customer: true, seller: true, adminMembership: true },
        },
      },
    });
    if (!current) throw new UnauthorizedException('Invalid refresh session');

    if (current.revokedAt) {
      await this.prisma.authSession.updateMany({
        where: { familyId: current.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.write({
        actorPrincipalId: current.principalId,
        sessionId: current.id,
        action: 'auth.refresh.reuse_detected',
        outcome: 'blocked',
        ipAddress: metadata.ipAddress,
      });
      throw new UnauthorizedException('Refresh session reuse detected');
    }
    if (current.expiresAt <= new Date() || current.principal.status !== 'active') {
      throw new UnauthorizedException('Refresh session expired');
    }

    const policy = APP_SECURITY[app];
    if (current.audience !== policy.audience || current.role !== policy.role) {
      throw new UnauthorizedException('Refresh session audience mismatch');
    }
    if (current.role === 'admin' && current.principal.adminMembership?.status !== 'active') {
      throw new UnauthorizedException('Administrator access revoked');
    }

    const identity = this.identityFromSession(current);
    const nextRefreshToken = randomBytes(48).toString('base64url');
    const nextSessionId = randomUUID();
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.authSession.updateMany({
          where: { id: current.id, revokedAt: null },
          data: { revokedAt: new Date(), replacedBySessionId: nextSessionId, lastUsedAt: new Date() },
        });
        if (claimed.count !== 1) throw new ConcurrentRefreshReuseError();
        await tx.authSession.create({
          data: {
            id: nextSessionId,
            principalId: current.principalId,
            familyId: current.familyId,
            role: current.role,
            audience: current.audience,
            refreshTokenHash: hashToken(nextRefreshToken),
            expiresAt: current.expiresAt,
            userAgent: metadata.userAgent?.slice(0, 500),
            ipAddress: metadata.ipAddress?.slice(0, 64),
          },
        });
      });
    } catch (error) {
      if (!(error instanceof ConcurrentRefreshReuseError)) throw error;
      await this.prisma.authSession.updateMany({
        where: { familyId: current.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.write({
        actorPrincipalId: current.principalId,
        sessionId: current.id,
        action: 'auth.refresh.concurrent_reuse_detected',
        outcome: 'blocked',
        ipAddress: metadata.ipAddress,
      });
      throw new UnauthorizedException('Refresh session reuse detected');
    }
    return this.response(identity, app, nextSessionId, nextRefreshToken);
  }

  async revoke(refreshToken: string | undefined, app: AuthApp): Promise<void> {
    if (!refreshToken) return;
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
    });
    if (!session || session.audience !== APP_SECURITY[app].audience) return;
    await this.prisma.authSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.write({
      actorPrincipalId: session.principalId,
      sessionId: session.id,
      action: 'auth.session.revoked',
      metadata: { app },
    });
  }

  private identityFromSession(current: {
    principalId: string;
    role: string;
    principal: {
      email: string;
      displayName: string | null;
      customer: { id: string; email: string; name: string | null } | null;
      seller: {
        id: string; name: string; slug: string; email: string; status: string; tier: string;
        connectorType: string | null; onboardingStep: string | null; emailVerified: boolean;
      } | null;
    };
  }): SessionIdentity {
    const role = current.role as TokenRole;
    return {
      principalId: current.principalId,
      email: current.principal.email,
      name: current.principal.displayName,
      role,
      ...(current.principal.customer ? { customer: publicCustomer(current.principal.customer) } : {}),
      ...(current.principal.seller ? { seller: publicSeller(current.principal.seller) } : {}),
    };
  }

  private response(
    identity: SessionIdentity,
    app: AuthApp,
    sessionId: string,
    refreshToken: string,
  ): SessionResponse {
    const policy = APP_SECURITY[app];
    const accessToken = signToken({
      sub: identity.principalId,
      sid: sessionId,
      role: identity.role,
      email: identity.email,
      audience: policy.audience,
      customerId: identity.customer?.id,
      sellerId: identity.seller?.id,
    }, policy.accessTtlSeconds);
    return {
      accessToken,
      token: accessToken,
      expiresIn: policy.accessTtlSeconds,
      user: { id: identity.principalId, email: identity.email, name: identity.name, role: identity.role },
      customer: identity.customer,
      seller: identity.seller,
      refreshToken,
    };
  }
}
