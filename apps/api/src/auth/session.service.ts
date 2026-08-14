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
  /**
   * Set when this response absorbed a concurrent-refresh race. The winning
   * request already rotated the cookie; this straggler must NOT overwrite it,
   * or it would clobber the live refresh token with a stale one.
   */
  refreshCookieUnchanged?: boolean;
}

/**
 * How long after a normal rotation a replayed token is treated as a race
 * rather than theft.
 *
 * Refresh tokens live in a cookie shared by every tab. Two tabs reading that
 * cookie before the winner's Set-Cookie lands will both present the same
 * value; the loser arrives holding a token that was legitimately rotated
 * moments ago. Observed bursts here were 1.8-18s apart, all from one
 * principal, all via Cloudflare edge IPs.
 *
 * Treating that as theft revoked the entire session family and logged the
 * user out everywhere — a self-inflicted logout with a security-shaped
 * signature. Outside this window a replay really is suspicious and still
 * hard-revokes.
 */
const REFRESH_RACE_GRACE_MS = 30_000;

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
      const absorbed = await this.absorbRefreshRace(current, app, metadata);
      if (absorbed) return absorbed;

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
      // Lost the claim to a simultaneous rotation. Re-read: if the winner just
      // replaced this row, the caller is the same straggler as above, not a
      // thief — absorb it rather than logging the user out of every device.
      const reread = await this.prisma.authSession.findUnique({
        where: { id: current.id },
        include: { principal: { include: { customer: true, seller: true, adminMembership: true } } },
      });
      if (reread) {
        const absorbed = await this.absorbRefreshRace(reread, app, metadata);
        if (absorbed) return absorbed;
      }
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

  /**
   * Decide whether a replayed refresh token is a concurrent-refresh race and,
   * if so, hand back a working access token instead of destroying the session
   * family.
   *
   * All three conditions must hold, and each rules out a different way this
   * could be genuine reuse:
   *  - `replacedBySessionId` is set — the row was ROTATED, not revoked by
   *    logout, a password change, or an earlier reuse cascade. Those leave it
   *    null, and must keep failing closed.
   *  - the rotation happened within the grace window.
   *  - the successor is still live and unexpired — if the family has since
   *    been revoked, this replay is arriving into an already-closed session
   *    and gets no help.
   *
   * No new refresh token is issued: the winning request already set the
   * cookie, which every tab shares, so the straggler's next refresh uses it.
   */
  private async absorbRefreshRace(
    current: { id: string; revokedAt: Date | null; replacedBySessionId: string | null; principalId: string; familyId: string },
    app: AuthApp,
    metadata: SessionMetadata,
  ): Promise<SessionResponse | null> {
    if (!current.revokedAt || !current.replacedBySessionId) return null;
    if (Date.now() - current.revokedAt.getTime() > REFRESH_RACE_GRACE_MS) return null;

    const successor = await this.prisma.authSession.findUnique({
      where: { id: current.replacedBySessionId },
      include: { principal: { include: { customer: true, seller: true, adminMembership: true } } },
    });
    if (!successor || successor.revokedAt || successor.expiresAt <= new Date()) return null;
    if (successor.principal.status !== 'active') return null;

    const policy = APP_SECURITY[app];
    if (successor.audience !== policy.audience || successor.role !== policy.role) return null;

    await this.audit.write({
      actorPrincipalId: current.principalId,
      sessionId: current.id,
      // Distinct from reuse_detected on purpose: this is an absorbed race, and
      // filing it under the theft signal would keep hiding real ones.
      action: 'auth.refresh.race_absorbed',
      outcome: 'success',
      ipAddress: metadata.ipAddress,
      metadata: { successorSessionId: successor.id },
    });

    return {
      ...this.response(this.identityFromSession(successor), app, successor.id, ''),
      refreshCookieUnchanged: true,
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
