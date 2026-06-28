import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import type { Prisma } from '@prisma/client';

export interface AuditInput {
  actorPrincipalId?: string;
  sessionId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  outcome?: string;
  correlationId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async write(input: AuditInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorPrincipalId: input.actorPrincipalId,
        sessionId: input.sessionId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        outcome: input.outcome ?? 'success',
        correlationId: input.correlationId,
        ipAddress: input.ipAddress,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
