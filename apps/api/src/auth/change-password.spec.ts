import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';

/**
 * Password change is the action a compromised account depends on, so the
 * cases worth pinning are the ones that would make it cosmetic: accepting a
 * wrong current password, or leaving other sessions alive afterwards.
 */
async function setup(passwordHash: string | null) {
  const prisma = {
    seller: {
      findUnique: vi.fn().mockResolvedValue(passwordHash === undefined ? null : { id: 's1', passwordHash }),
      update: vi.fn().mockResolvedValue({}),
    },
    authSession: {
      findUnique: vi.fn().mockResolvedValue({ familyId: 'fam-current' }),
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
  };
  const service = new AuthService(prisma as never);
  return { service, prisma };
}

const CURRENT = 'currentPassw0rd!';

describe('AuthService.changeSellerPassword', () => {
  it('rehashes the password and revokes every other session family', async () => {
    const hash = await bcrypt.hash(CURRENT, 4);
    const { service, prisma } = await setup(hash);

    const result = await service.changeSellerPassword('s1', 'p1', 'sess1', {
      currentPassword: CURRENT, newPassword: 'brandNewPassw0rd!',
    });

    expect(result).toEqual({ ok: true, otherSessionsRevoked: 3 });

    const written = prisma.seller.update.mock.calls[0][0].data.passwordHash as string;
    expect(written).not.toBe(hash);
    expect(await bcrypt.compare('brandNewPassw0rd!', written)).toBe(true);

    // Other devices must lose their refresh tokens, or a stolen session
    // survives the very change meant to kill it.
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        principalId: 'p1', revokedAt: null, familyId: { not: 'fam-current' },
      }),
    }));
  });

  it('rejects a wrong current password and changes nothing', async () => {
    const { service, prisma } = await setup(await bcrypt.hash(CURRENT, 4));

    await expect(service.changeSellerPassword('s1', 'p1', 'sess1', {
      currentPassword: 'not-the-password', newPassword: 'brandNewPassw0rd!',
    })).rejects.toThrow('Current password is incorrect');

    expect(prisma.seller.update).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to "change" a password to the same value', async () => {
    const { service, prisma } = await setup(await bcrypt.hash(CURRENT, 4));

    await expect(service.changeSellerPassword('s1', 'p1', 'sess1', {
      currentPassword: CURRENT, newPassword: CURRENT,
    })).rejects.toThrow(/must be different/);

    expect(prisma.seller.update).not.toHaveBeenCalled();
  });

  it('refuses on a Google-only account rather than silently setting a password', async () => {
    const { service, prisma } = await setup(null);

    await expect(service.changeSellerPassword('s1', 'p1', 'sess1', {
      currentPassword: 'anything', newPassword: 'brandNewPassw0rd!',
    })).rejects.toThrow(/signs in with Google/);

    expect(prisma.seller.update).not.toHaveBeenCalled();
  });

  it('still revokes other sessions when the current session id cannot be resolved', async () => {
    const { service, prisma } = await setup(await bcrypt.hash(CURRENT, 4));
    prisma.authSession.findUnique.mockResolvedValue(null);

    await service.changeSellerPassword('s1', 'p1', undefined, {
      currentPassword: CURRENT, newPassword: 'brandNewPassw0rd!',
    });

    // Without a known family the safe default is revoking everything, not
    // skipping revocation.
    const where = prisma.authSession.updateMany.mock.calls[0][0].where;
    expect(where).toEqual({ principalId: 'p1', revokedAt: null });
  });
});
