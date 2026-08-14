import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';

function setup(rows: unknown[] = [], total = 0) {
  const prisma = {
    auditEvent: {
      findMany: vi.fn().mockResolvedValue(rows),
      count: vi.fn().mockResolvedValue(total),
      groupBy: vi.fn().mockResolvedValue([{ action: 'api.post' }, { action: 'seller.suspended' }]),
    },
  };
  return { service: new AuditService(prisma as never), prisma };
}

describe('AuditService.list', () => {
  it('hides api.* request noise by default', async () => {
    const { service, prisma } = setup();

    await service.list({});

    // The interceptor writes one api.* row per mutating request; they are the
    // large majority of the table and bury the deliberate events.
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { NOT: { action: { startsWith: 'api.' } } },
    }));
  });

  it('includes request rows only when explicitly asked', async () => {
    const { service, prisma } = setup();

    await service.list({ includeRequests: true });

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('filters by action and outcome together', async () => {
    const { service, prisma } = setup();

    await service.list({ action: 'auth.password.changed', outcome: 'failure' });

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ action: 'auth.password.changed', outcome: 'failure' }),
    }));
  });

  it('clamps limit so one query cannot pull the whole table', async () => {
    const { service, prisma } = setup();

    await service.list({ limit: 100000 });

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
  });

  it('joins the actor email, which is what makes a row human-readable', async () => {
    const { service, prisma } = setup();

    await service.list({});

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { actor: { select: { id: true, email: true } } },
    }));
  });
});
