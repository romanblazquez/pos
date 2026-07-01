import { Injectable, Inject, ConflictException, UnauthorizedException } from '@nestjs/common';
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

  async updateOnboardingStep(
    sellerId: string,
    step: string,
    data: Record<string, unknown>,
  ) {
    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: { onboardingData: true },
    });

    const merged = {
      ...(seller.onboardingData as Record<string, unknown> ?? {}),
      ...data,
    };

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        onboardingStep: step,
        onboardingData: merged as Prisma.InputJsonValue,
        // Activate seller when they reach the final step
        ...(step === 'complete' ? { status: 'active' } : {}),
      },
    });

    return { step: updated.onboardingStep, status: updated.status };
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
