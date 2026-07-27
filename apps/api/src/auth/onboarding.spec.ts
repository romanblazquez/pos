import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AuthService, ONBOARDING_STEPS } from './auth.service.js';

/**
 * The rule under test is a business rule, not a formatting one: finishing the
 * seller wizard must never publish a seller. Only `active` sellers are shown on
 * the public site, and approval is an admin decision.
 */
function serviceWith(seller: { onboardingData: Record<string, unknown> | null; status: string }) {
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    onboardingStep: data.onboardingStep,
    status: seller.status,
    onboardingData: data.onboardingData,
  }));
  const prisma = {
    seller: {
      findUniqueOrThrow: vi.fn(async () => seller),
      update,
    },
  };
  // Only the onboarding path is exercised; the rest of AuthService's deps are
  // untouched by it.
  const service = new AuthService(prisma as never);
  return { service, update };
}

const COMPLETE = {
  storeType: 'connect',
  shipsFrom: 'CDMX, México',
  offersPickup: false,
  commissionAccepted: true,
};

describe('seller onboarding', () => {
  let seller: { onboardingData: Record<string, unknown> | null; status: string };

  beforeEach(() => {
    seller = { onboardingData: null, status: 'pending' };
  });

  it('does not activate a seller who finishes the wizard', async () => {
    const { service, update } = serviceWith(seller);
    const result = await service.updateOnboardingStep('s1', 'complete', COMPLETE);

    // The regression this exists for: `complete` used to set status 'active',
    // which put an unreviewed seller's prices on the public site.
    expect(update.mock.calls[0][0].data).not.toHaveProperty('status');
    expect(result.status).toBe('pending');
    expect(result.awaitingReview).toBe(true);
  });

  it('refuses a completion that skipped the wizard', async () => {
    const { service } = serviceWith(seller);
    // `POST {"step":"complete"}` with an empty body was enough to go live.
    await expect(service.updateOnboardingStep('s1', 'complete', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('names every field the seller still owes', async () => {
    const { service } = serviceWith(seller);
    await expect(
      service.updateOnboardingStep('s1', 'complete', { storeType: 'connect' }),
    ).rejects.toThrow(/shipsFrom.*commissionAccepted|commissionAccepted.*shipsFrom/);
  });

  it('will not accept a completion without the commission agreed', async () => {
    const { service } = serviceWith(seller);
    await expect(
      service.updateOnboardingStep('s1', 'complete', { ...COMPLETE, commissionAccepted: false }),
    ).rejects.toThrow(/commissionAccepted/);
  });

  it('stamps commission acceptance server-side', async () => {
    const { service, update } = serviceWith(seller);
    await service.updateOnboardingStep('s1', 'complete', COMPLETE);
    const saved = update.mock.calls[0][0].data.onboardingData as Record<string, unknown>;
    // The client sends a boolean; when it was accepted is ours to record.
    expect(typeof saved.commissionAcceptedAt).toBe('string');
    expect(typeof saved.submittedAt).toBe('string');
  });

  it('rejects a step it does not know', async () => {
    const { service } = serviceWith(seller);
    await expect(service.updateOnboardingStep('s1', 'live', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('merges intermediate steps without demanding the whole form', async () => {
    seller.onboardingData = { storeType: 'connect' };
    const { service, update } = serviceWith(seller);
    await service.updateOnboardingStep('s1', 'shipping', { shipsFrom: 'Rosario, Argentina' });
    expect(update.mock.calls[0][0].data.onboardingData).toEqual({
      storeType: 'connect',
      shipsFrom: 'Rosario, Argentina',
    });
  });

  it('reports an already-approved seller as no longer awaiting review', async () => {
    seller.status = 'active';
    const { service } = serviceWith(seller);
    const result = await service.updateOnboardingStep('s1', 'complete', COMPLETE);
    expect(result.awaitingReview).toBe(false);
  });

  it('keeps `complete` as the terminal step', () => {
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe('complete');
  });
});
