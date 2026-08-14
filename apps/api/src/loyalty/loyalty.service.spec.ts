import { describe, expect, it, vi } from 'vitest';
import { LoyaltyService } from './loyalty.service.js';

/**
 * Clawback is the half of the refund path that decides whether a
 * buy-then-refund loop mints free credits, so it is tested against the two
 * cases that actually differ: the buyer still holds the cashback, and the
 * buyer already spent it.
 */
function setup(wallet: { id: string; platformCreditsMinor: number } | null, storeBalance: number | null) {
  const tx = {
    customerWallet: { findUnique: vi.fn().mockResolvedValue(wallet), update: vi.fn() },
    storeCredit: {
      findUnique: vi.fn().mockResolvedValue(storeBalance === null ? null : { balanceMinor: storeBalance }),
      update: vi.fn(),
    },
    walletTransaction: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn().mockImplementation((fn) => fn(tx)) };
  const service = new LoyaltyService(prisma as never);
  return { service, tx };
}

describe('LoyaltyService.clawbackCashback', () => {
  it('reverses the full cashback when the buyer still holds it', async () => {
    const { service, tx } = setup({ id: 'w1', platformCreditsMinor: 1000 }, 400);

    const result = await service.clawbackCashback({
      customerId: 'c1', sellerId: 's1', orderId: 'o1',
      platformCashbackMinor: 300, storeCashbackMinor: 200,
    });

    expect(result).toEqual({ platformClawedBackMinor: 300, storeClawedBackMinor: 200 });
    expect(tx.customerWallet.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { platformCreditsMinor: { decrement: 300 } },
    }));
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amountMinor: -300 }),
    }));
  });

  it('recovers only what is left when the buyer already spent some of it', async () => {
    const { service, tx } = setup({ id: 'w1', platformCreditsMinor: 120 }, 50);

    const result = await service.clawbackCashback({
      customerId: 'c1', sellerId: 's1', orderId: 'o1',
      platformCashbackMinor: 300, storeCashbackMinor: 200,
    });

    // Credits are not a debt we can chase — take what is there, report the truth.
    expect(result).toEqual({ platformClawedBackMinor: 120, storeClawedBackMinor: 50 });
    expect(tx.customerWallet.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { platformCreditsMinor: { decrement: 120 } },
    }));
  });

  it('never drives a balance negative when the cashback is entirely spent', async () => {
    const { service, tx } = setup({ id: 'w1', platformCreditsMinor: 0 }, 0);

    const result = await service.clawbackCashback({
      customerId: 'c1', sellerId: 's1', orderId: 'o1',
      platformCashbackMinor: 300, storeCashbackMinor: 200,
    });

    expect(result).toEqual({ platformClawedBackMinor: 0, storeClawedBackMinor: 0 });
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.storeCredit.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('is a no-op when the order earned no cashback', async () => {
    const { service, tx } = setup({ id: 'w1', platformCreditsMinor: 1000 }, 400);

    const result = await service.clawbackCashback({
      customerId: 'c1', sellerId: 's1', orderId: 'o1',
      platformCashbackMinor: 0, storeCashbackMinor: 0,
    });

    expect(result).toEqual({ platformClawedBackMinor: 0, storeClawedBackMinor: 0 });
    expect(tx.customerWallet.findUnique).not.toHaveBeenCalled();
  });

  it('does nothing when the customer has no wallet at all', async () => {
    const { service, tx } = setup(null, null);

    const result = await service.clawbackCashback({
      customerId: 'c1', sellerId: 's1', orderId: 'o1',
      platformCashbackMinor: 300, storeCashbackMinor: 200,
    });

    expect(result).toEqual({ platformClawedBackMinor: 0, storeClawedBackMinor: 0 });
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });
});
