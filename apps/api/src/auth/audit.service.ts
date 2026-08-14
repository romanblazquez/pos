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

  /**
   * Read the audit trail.
   *
   * The platform has been writing audit events since launch and nothing could
   * ever read them back — over a thousand rows, including `auth.refresh.
   * reuse_detected`, which is the signal that a rotated refresh token was
   * replayed (the classic stolen-session indicator). An audit log nobody can
   * query is a log that does not exist.
   *
   * `api.*` rows are excluded by default: the security interceptor writes one
   * per mutating request, so they are ~85% of the table and bury the
   * deliberate, human-meaningful events under request noise. Pass
   * `includeRequests` to see them.
   */
  async list(params: {
    action?: string;
    targetType?: string;
    targetId?: string;
    outcome?: string;
    includeRequests?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ events: unknown[]; total: number }> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    const where: Prisma.AuditEventWhereInput = {
      ...(params.action ? { action: params.action } : {}),
      ...(params.targetType ? { targetType: params.targetType } : {}),
      ...(params.targetId ? { targetId: params.targetId } : {}),
      ...(params.outcome ? { outcome: params.outcome } : {}),
      ...(params.includeRequests ? {} : { NOT: { action: { startsWith: 'api.' } } }),
    };

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        // The actor's email is the only thing that makes a row readable by a
        // human; the principal id alone means opening another query per line.
        include: { actor: { select: { id: true, email: true } } },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return { events, total };
  }

  /** Distinct action names present, for the filter control. */
  async actions(): Promise<string[]> {
    const rows = await this.prisma.auditEvent.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 60,
    });
    return rows.map((row) => row.action);
  }
}
