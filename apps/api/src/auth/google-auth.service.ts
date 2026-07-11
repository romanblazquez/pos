import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException, ForbiddenException, Inject, Injectable,
  ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '@retail-os/db-postgres';
import type { AuthApp } from './auth.constants.js';
import { publicSeller, type SessionIdentity } from './session.service.js';

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class GoogleAuthService {
  private readonly google = new OAuth2Client();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createChallenge(app: AuthApp): Promise<{ nonce: string; state: string }> {
    this.clientId(app); // fail before rendering a non-functional Google button
    await this.prisma.authChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const nonce = randomBytes(32).toString('base64url');
    const state = randomBytes(32).toString('base64url');
    await this.prisma.authChallenge.create({
      data: {
        app,
        nonceHash: hash(nonce),
        stateHash: hash(state),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return { nonce, state };
  }

  async authenticate(
    credential: string,
    state: string,
    app: AuthApp,
  ): Promise<SessionIdentity> {
    const challenge = await this.prisma.authChallenge.findUnique({ where: { stateHash: hash(state) } });
    if (!challenge || challenge.app !== app || challenge.consumedAt || challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired Google login challenge');
    }

    const ticket = await this.google.verifyIdToken({
      idToken: credential,
      audience: this.clientId(app),
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Google account email is not verified');
    }
    if (!payload.nonce || hash(payload.nonce) !== challenge.nonceHash) {
      throw new UnauthorizedException('Google login nonce mismatch');
    }

    const consumed = await this.prisma.authChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException('Google login challenge was already used');

    const normalizedEmail = normalizeEmail(payload.email);
    let identity = await this.prisma.federatedIdentity.findUnique({
      where: { provider_providerSubject: { provider: 'google', providerSubject: payload.sub } },
      include: { principal: true },
    });

    if (!identity) {
      const existingPrincipal = await this.prisma.authPrincipal.findUnique({ where: { normalizedEmail } });
      if (existingPrincipal && !this.googleIsAuthoritative(normalizedEmail, payload.hd)) {
        throw new ConflictException('Sign in with the existing password first to link this Google account');
      }
      const principal = existingPrincipal ?? await this.prisma.authPrincipal.create({
        data: {
          email: payload.email,
          normalizedEmail,
          displayName: payload.name,
        },
      });
      identity = await this.prisma.federatedIdentity.create({
        data: {
          principalId: principal.id,
          provider: 'google',
          providerSubject: payload.sub,
          providerEmail: payload.email,
          emailVerified: true,
          hostedDomain: payload.hd,
        },
        include: { principal: true },
      });
    } else if (identity.principal.status !== 'active') {
      throw new ForbiddenException('Account is disabled');
    }

    await this.prisma.federatedIdentity.update({
      where: { id: identity.id },
      data: {
        providerEmail: payload.email,
        emailVerified: true,
        hostedDomain: payload.hd,
      },
    });

    if (app === 'admin') return this.authorizeAdmin(identity.principal.id, normalizedEmail, payload.name);
    if (app === 'seller') return this.authorizeSeller(identity.principal.id, normalizedEmail, payload.name);
    return this.authorizeCustomer(identity.principal.id, payload.email, payload.name);
  }

  private async authorizeAdmin(principalId: string, email: string, name?: string): Promise<SessionIdentity> {
    const membership = await this.prisma.platformAdminMembership.findUnique({ where: { email } });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('This Google account is not an authorized administrator');
    }
    if (membership.principalId && membership.principalId !== principalId) {
      throw new ForbiddenException('Administrator identity is already linked');
    }
    await this.prisma.platformAdminMembership.update({
      where: { id: membership.id },
      data: { principalId },
    });
    return { principalId, email, name, role: 'admin' };
  }

  // Existing sellers link their Google identity and sign in; a first-time Google
  // seller is auto-provisioned as a pending account that lands in onboarding —
  // mirroring registerSeller (which also creates status 'pending' / 'store-type').
  private async authorizeSeller(principalId: string, email: string, name?: string): Promise<SessionIdentity> {
    const existing = await this.prisma.seller.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing?.authPrincipalId && existing.authPrincipalId !== principalId) {
      throw new ConflictException('Seller account is linked to another identity');
    }
    if (existing && (existing.status === 'suspended' || existing.status === 'churned')) {
      throw new ForbiddenException('Seller account is not active');
    }
    const seller = existing
      ? await this.prisma.seller.update({
          where: { id: existing.id },
          data: { authPrincipalId: principalId, emailVerified: true },
        })
      : await this.prisma.seller.create({
          data: {
            name: name ?? email,
            slug: await this.uniqueSellerSlug(name ?? email),
            email,
            country: 'MX',
            status: 'pending',
            onboardingStep: 'store-type',
            emailVerified: true,
            authPrincipalId: principalId,
          },
        });
    return {
      principalId,
      email: seller.email,
      name: seller.name,
      role: 'seller',
      seller: publicSeller(seller),
    };
  }

  private async uniqueSellerSlug(name: string): Promise<string> {
    const base = slugify(name) || 'tienda';
    const conflict = await this.prisma.seller.findUnique({ where: { slug: base } });
    return conflict ? `${base}-${Date.now()}` : base;
  }

  private async authorizeCustomer(principalId: string, email: string, name?: string): Promise<SessionIdentity> {
    const existing = await this.prisma.mktCustomer.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing?.authPrincipalId && existing.authPrincipalId !== principalId) {
      throw new ConflictException('Customer account is linked to another identity');
    }
    const customer = existing
      ? await this.prisma.mktCustomer.update({
          where: { id: existing.id },
          data: { authPrincipalId: principalId, emailVerified: true, name: existing.name ?? name },
        })
      : await this.prisma.mktCustomer.create({
          data: { email, name, emailVerified: true, authPrincipalId: principalId },
        });
    return {
      principalId,
      email,
      name: customer.name,
      role: 'customer',
      customer: { id: customer.id, email: customer.email, name: customer.name },
    };
  }

  private clientId(app: AuthApp): string {
    const value = app === 'admin'
      ? process.env.GOOGLE_ADMIN_CLIENT_ID
      : app === 'seller'
        ? process.env.GOOGLE_SELLER_CLIENT_ID
        : process.env.GOOGLE_MARKETPLACE_CLIENT_ID;
    if (!value) throw new ServiceUnavailableException(`Google login is not configured for ${app}`);
    return value;
  }

  private googleIsAuthoritative(email: string, hostedDomain?: string): boolean {
    return email.endsWith('@gmail.com') || Boolean(hostedDomain);
  }
}
