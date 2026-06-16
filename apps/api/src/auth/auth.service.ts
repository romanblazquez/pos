import { Injectable, Inject, ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '@retail-os/db-postgres';
import { signToken } from './jwt.js';

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

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async registerSeller(dto: RegisterSellerDto) {
    const existing = await this.prisma.seller.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    let slug = slugify(dto.name);
    const slugConflict = await this.prisma.seller.findUnique({ where: { slug } });
    if (slugConflict) slug = `${slug}-${Date.now()}`;

    const seller = await this.prisma.seller.create({
      data: {
        name: dto.name,
        slug,
        email: dto.email,
        phone: dto.phone,
        country: dto.country ?? 'MX',
        passwordHash,
        status: 'pending',
        onboardingStep: 'store-type',
      },
    });

    const token = signToken({ sub: seller.id, role: 'seller', email: seller.email });
    return {
      token,
      seller: this.publicSeller(seller),
    };
  }

  async loginSeller(dto: LoginDto) {
    const seller = await this.prisma.seller.findUnique({ where: { email: dto.email } });
    if (!seller?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, seller.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const token = signToken({ sub: seller.id, role: 'seller', email: seller.email });
    return { token, seller: this.publicSeller(seller) };
  }

  async registerCustomer(dto: RegisterCustomerDto) {
    const existing = await this.prisma.mktCustomer.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const customer = await this.prisma.mktCustomer.create({
      data: { email: dto.email, name: dto.name, passwordHash },
    });

    const token = signToken({ sub: customer.id, role: 'customer', email: customer.email });
    return { token, customer: { id: customer.id, email: customer.email, name: customer.name } };
  }

  async loginCustomer(dto: LoginDto) {
    const customer = await this.prisma.mktCustomer.findUnique({ where: { email: dto.email } });
    if (!customer?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const token = signToken({ sub: customer.id, role: 'customer', email: customer.email });
    return { token, customer: { id: customer.id, email: customer.email, name: customer.name } };
  }

  async getSellerProfile(sellerId: string) {
    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      include: { score: true },
    });
    return this.publicSeller(seller);
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
        onboardingData: merged,
        // Activate seller when they reach the final step
        ...(step === 'complete' ? { status: 'active' } : {}),
      },
    });

    return { step: updated.onboardingStep, status: updated.status };
  }

  private publicSeller(s: {
    id: string; name: string; slug: string; email: string;
    status: string; tier: string; connectorType: string | null;
    onboardingStep: string | null; emailVerified: boolean;
  }) {
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      email: s.email,
      status: s.status,
      tier: s.tier,
      connectorType: s.connectorType,
      onboardingStep: s.onboardingStep,
      emailVerified: s.emailVerified,
    };
  }
}
