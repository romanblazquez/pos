import { describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service.js';

/**
 * The grace window has to absorb a concurrent-refresh race WITHOUT weakening
 * genuine reuse detection, so the tests are mostly about the boundaries: what
 * must still hard-revoke.
 */
const PRINCIPAL = {
  id: 'p1', status: 'active', email: 'owner@example.com', name: 'Owner',
  customer: null, seller: null, adminMembership: null,
};

function sessionRow(over: Record<string, unknown> = {}) {
  return {
    id: 'sess-old', principalId: 'p1', familyId: 'fam1',
    role: 'seller', audience: 'seller-api',
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null, replacedBySessionId: null,
    principal: PRINCIPAL,
    ...over,
  };
}

function setup(current: Record<string, unknown>, successor: Record<string, unknown> | null) {
  const prisma = {
    authSession: {
      findUnique: vi.fn().mockImplementation(({ where }) =>
        where.refreshTokenHash ? current : (successor && where.id === (current as any).replacedBySessionId ? successor : null)),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const audit = { write: vi.fn().mockResolvedValue(undefined) };
  return { service: new SessionService(prisma as never, audit as never), prisma, audit };
}

describe('SessionService.rotate — concurrent refresh race', () => {
  it('absorbs a token rotated seconds ago and does NOT revoke the family', async () => {
    const current = sessionRow({ revokedAt: new Date(Date.now() - 2_000), replacedBySessionId: 'sess-new' });
    const successor = sessionRow({ id: 'sess-new', revokedAt: null, replacedBySessionId: null });
    const { service, prisma, audit } = setup(current, successor);

    const res = await service.rotate('tok', 'seller', {});

    // The straggler gets a working access token bound to the successor...
    expect(res.accessToken).toBeTruthy();
    // ...carries no new refresh token, so the controller leaves the live
    // cookie the winner just set alone...
    expect(res.refreshCookieUnchanged).toBe(true);
    // ...and nothing gets revoked.
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'auth.refresh.race_absorbed', outcome: 'success',
    }));
  });

  it('still hard-revokes a replay outside the grace window', async () => {
    const current = sessionRow({ revokedAt: new Date(Date.now() - 120_000), replacedBySessionId: 'sess-new' });
    const successor = sessionRow({ id: 'sess-new' });
    const { service, prisma, audit } = setup(current, successor);

    await expect(service.rotate('tok', 'seller', {})).rejects.toThrow(/reuse detected/);

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { familyId: 'fam1', revokedAt: null },
    }));
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'auth.refresh.reuse_detected',
    }));
  });

  it('still hard-revokes a token revoked by logout or password change', async () => {
    // Those paths null out replacedBySessionId — the row was killed, not
    // rotated, so there is no successor to hand back and no race to absorb.
    const current = sessionRow({ revokedAt: new Date(Date.now() - 1_000), replacedBySessionId: null });
    const { service, prisma } = setup(current, null);

    await expect(service.rotate('tok', 'seller', {})).rejects.toThrow(/reuse detected/);
    expect(prisma.authSession.updateMany).toHaveBeenCalled();
  });

  it('still hard-revokes when the successor is itself already revoked', async () => {
    // The family has since been closed; a replay arriving into it gets no help.
    const current = sessionRow({ revokedAt: new Date(Date.now() - 1_000), replacedBySessionId: 'sess-new' });
    const successor = sessionRow({ id: 'sess-new', revokedAt: new Date() });
    const { service, prisma } = setup(current, successor);

    await expect(service.rotate('tok', 'seller', {})).rejects.toThrow(/reuse detected/);
    expect(prisma.authSession.updateMany).toHaveBeenCalled();
  });

  it('refuses to absorb across a different app audience', async () => {
    const current = sessionRow({ revokedAt: new Date(Date.now() - 1_000), replacedBySessionId: 'sess-new' });
    const successor = sessionRow({ id: 'sess-new', audience: 'admin-api', role: 'admin' });
    const { service, prisma } = setup(current, successor);

    await expect(service.rotate('tok', 'seller', {})).rejects.toThrow(/reuse detected/);
    expect(prisma.authSession.updateMany).toHaveBeenCalled();
  });
});
