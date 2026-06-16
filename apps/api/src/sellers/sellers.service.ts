import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';

export interface CreateSellerDto {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  timezone?: string;
  connectorType?: string;
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
export class SellersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(dto: CreateSellerDto) {
    const existing = await this.prisma.seller.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    let slug = slugify(dto.name);
    // Ensure uniqueness
    const conflict = await this.prisma.seller.findUnique({ where: { slug } });
    if (conflict) slug = `${slug}-${Date.now()}`;

    return this.prisma.seller.create({
      data: {
        name: dto.name,
        slug,
        email: dto.email,
        phone: dto.phone,
        country: dto.country ?? 'MX',
        timezone: dto.timezone ?? 'America/Mexico_City',
        connectorType: dto.connectorType,
        status: 'pending',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.seller.findUnique({
      where: { id },
      include: { score: true, syncLogs: { take: 10, orderBy: { startedAt: 'desc' } } },
    });
  }

  async getSyncHealth(sellerId: string) {
    const logs = await this.prisma.connectorSyncLog.findMany({
      where: { sellerId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const byType = ['catalog', 'inventory', 'prices'].map((type) => {
      const latest = logs.find((l) => l.syncType === type);
      return {
        type,
        status: latest?.status ?? 'never',
        lastRun: latest?.startedAt ?? null,
        itemsSynced: latest?.itemsSynced ?? 0,
        itemsFailed: latest?.itemsFailed ?? 0,
        errors: latest?.errors ?? null,
      };
    });

    return { sellerId, syncs: byType };
  }

  async setConnectorType(sellerId: string, connectorType: string) {
    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { connectorType },
      select: { id: true, connectorType: true },
    });
  }

  async list(params: { status?: string; limit?: number; offset?: number }) {
    const { status, limit = 50, offset = 0 } = params;
    return this.prisma.seller.findMany({
      where: status ? { status } : {},
      include: { score: true },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }
}
