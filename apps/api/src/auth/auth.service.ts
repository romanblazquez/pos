import { BadRequestException, Injectable, Inject, ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '@retail-os/db-postgres';
import { publicSeller, publicCustomer, type SessionIdentity } from './session.service.js';
import type { Prisma } from '@prisma/client';

export interface RegisterSellerDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
  country?: string;
}

export interface RegisterCustomerDto {
  email: string;
  password: string;
  name?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

/**
 * The wizard's steps, in order. `complete` means "submitted for review", not
 * "live" — approval is an admin action (`POST /sellers/:id/reactivate`).
 */
export const ONBOARDING_STEPS = [
  'store-type',
  'connector',
  'credentials',
  'shipping',
  'terms',
  'complete',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * What a seller must actually have supplied before they can be reviewed.
 *
 * Checked on the server because the wizard's own gating is client-side, and the
 * endpoint is reachable without it. Kept deliberately small — this is the
 * minimum needed to judge an application, not a full merchant profile.
 */
function missingOnboardingFields(data: Record<string, unknown>): string[] {
  const missing: string[] = [];
  const storeType = data.storeType;
  if (storeType !== 'connect' && storeType !== 'create') missing.push('storeType');
  if (typeof data.shipsFrom !== 'string' || !data.shipsFrom.trim()) missing.push('shipsFrom');
  if (data.commissionAccepted !== true) missing.push('commissionAccepted');
  return missing;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async registerSeller(dto: RegisterSellerDto): Promise<SessionIdentity> {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.seller.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    let slug = slugify(dto.name);
    const slugConflict = await this.prisma.seller.findUnique({ where: { slug } });
    if (slugConflict) slug = `${slug}-${Date.now()}`;

    const principal = await this.ensurePrincipal(email, dto.name);
    const seller = await this.prisma.seller.create({
      data: {
        name: dto.name,
        slug,
        email,
        phone: dto.phone,
        country: dto.country ?? 'MX',
        passwordHash,
        status: 'pending',
        onboardingStep: 'store-type',
        authPrincipalId: principal.id,
      },
    });
    return {
      principalId: principal.id,
      email: seller.email,
      name: seller.name,
      role: 'seller',
      seller: publicSeller(seller),
    };
  }

  async loginSeller(dto: LoginDto): Promise<SessionIdentity> {
    const seller = await this.prisma.seller.findFirst({
      where: { email: { equals: normalizeEmail(dto.email), mode: 'insensitive' } },
    });
    if (!seller?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, seller.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const principal = seller.authPrincipalId
      ? await this.prisma.authPrincipal.findUniqueOrThrow({ where: { id: seller.authPrincipalId } })
      : await this.linkSellerPrincipal(seller.id, seller.email, seller.name);
    return {
      principalId: principal.id,
      email: seller.email,
      name: seller.name,
      role: 'seller',
      seller: publicSeller(seller),
    };
  }

  async registerCustomer(dto: RegisterCustomerDto): Promise<SessionIdentity> {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.mktCustomer.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const principal = await this.ensurePrincipal(email, dto.name);
    const customer = await this.prisma.mktCustomer.create({
      data: { email, name: dto.name, passwordHash, authPrincipalId: principal.id },
    });
    return {
      principalId: principal.id,
      email: customer.email,
      name: customer.name,
      role: 'customer',
      customer: publicCustomer(customer),
    };
  }

  async loginCustomer(dto: LoginDto): Promise<SessionIdentity> {
    const customer = await this.prisma.mktCustomer.findFirst({
      where: { email: { equals: normalizeEmail(dto.email), mode: 'insensitive' } },
    });
    if (!customer?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const principal = customer.authPrincipalId
      ? await this.prisma.authPrincipal.findUniqueOrThrow({ where: { id: customer.authPrincipalId } })
      : await this.linkCustomerPrincipal(customer.id, customer.email, customer.name);
    return {
      principalId: principal.id,
      email: customer.email,
      name: customer.name,
      role: 'customer',
      customer: publicCustomer(customer),
    };
  }

  async getSellerProfile(sellerId: string) {
    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      include: { score: true },
    });
    return publicSeller(seller);
  }

  async getCustomerProfile(customerId: string) {
    const customer = await this.prisma.mktCustomer.findUniqueOrThrow({
      where: { id: customerId },
      select: { id: true, email: true, name: true, phone: true, emailVerified: true },
    });
    return customer;
  }

  /**
   * Record progress through the seller onboarding wizard.
   *
   * Finishing the wizard does NOT make a seller public. It used to: reaching
   * `complete` set `status: 'active'`, and `active` is the one status whose
   * offers are shown (see `SELLER_VISIBLE_STATUS`). So anyone who could sign in
   * with Google — which auto-provisions a seller — could put their own prices
   * on a price-comparison site with nobody having looked at them. The comment
   * on `SELLER_VISIBLE_STATUS` says "`pending` sellers have not been reviewed";
   * this makes that true. A finished seller stays `pending` and waits for an
   * admin to approve them.
   *
   * The step is also no longer taken on trust. It arrived straight off the
   * request body, so `{"step":"complete"}` by curl skipped the wizard entirely —
   * no store, no shipping origin, no accepted commission — and went live.
   */
  async updateOnboardingStep(
    sellerId: string,
    step: string,
    data: Record<string, unknown>,
  ) {
    if (!ONBOARDING_STEPS.includes(step as OnboardingStep)) {
      throw new BadRequestException(`Unknown onboarding step "${step}"`);
    }

    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: { onboardingData: true, status: true },
    });

    const merged = {
      ...(seller.onboardingData as Record<string, unknown> ?? {}),
      ...data,
    };

    if (step === 'complete') {
      const missing = missingOnboardingFields(merged);
      if (missing.length) {
        throw new BadRequestException(
          `Onboarding is incomplete: ${missing.join(', ')}`,
        );
      }
      // Stamped server-side, from the request that actually asserted it. The
      // commission is charged against this, so "the seller accepted" needs to be
      // a record we hold rather than a checkbox the client says it rendered.
      merged.commissionAcceptedAt ??= new Date().toISOString();
      merged.submittedAt ??= new Date().toISOString();
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        onboardingStep: step,
        onboardingData: merged as Prisma.InputJsonValue,
      },
    });

    return {
      step: updated.onboardingStep,
      status: updated.status,
      // The portal needs to tell the seller why their listings are not live yet,
      // and "you are done" is the wrong thing to say to someone awaiting review.
      awaitingReview: updated.onboardingStep === 'complete' && updated.status === 'pending',
    };
  }

  private ensurePrincipal(email: string, displayName?: string | null) {
    const normalizedEmail = email.trim().toLowerCase();
    return this.prisma.authPrincipal.upsert({
      where: { normalizedEmail },
      create: { email, normalizedEmail, displayName },
      update: { displayName: displayName ?? undefined },
    });
  }

  private async linkSellerPrincipal(sellerId: string, email: string, name: string) {
    const principal = await this.ensurePrincipal(email, name);
    await this.prisma.seller.update({ where: { id: sellerId }, data: { authPrincipalId: principal.id } });
    return principal;
  }

  private async linkCustomerPrincipal(customerId: string, email: string, name?: string | null) {
    const principal = await this.ensurePrincipal(email, name);
    await this.prisma.mktCustomer.update({
      where: { id: customerId },
      data: { authPrincipalId: principal.id },
    });
    return principal;
  }
}
