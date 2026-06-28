import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';

const DEFAULT_INITIAL_ADMIN = 'matiasblazquez@gmail.com';

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const emails = (process.env.PLATFORM_ADMIN_EMAILS ?? DEFAULT_INITIAL_ADMIN)
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    await Promise.all(emails.map((email) => this.prisma.platformAdminMembership.upsert({
      where: { email },
      create: { email, role: 'platform_admin', status: 'active' },
      update: {},
    })));
  }
}
