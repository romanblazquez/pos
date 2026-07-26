import { describe, expect, it } from 'vitest';
import { canRedeemCredit, type CreditRedemptionRequest } from './credit-eligibility.js';

const base: CreditRedemptionRequest = {
  creditMarketCode: 'MX',
  creditCurrency: 'MXN',
  balanceMinor: 100_000,
  purchaseMarketCode: 'MX',
  purchaseCurrency: 'MXN',
  amountMinor: 50_000,
  paymentRail: 'mercadopago',
};

describe('cashback redemption', () => {
  it('allows redemption inside the market the credit was earned in', () => {
    expect(canRedeemCredit(base)).toEqual({ allowed: true });
  });

  // The core rule: credit is a liability in a specific currency. Spending MXN
  // credit on an Argentine purchase makes the platform eat the FX spread and
  // moves value across a tax border with no matching transaction.
  it('refuses credit earned in another market', () => {
    expect(canRedeemCredit({ ...base, purchaseMarketCode: 'AR', purchaseCurrency: 'ARS' }))
      .toEqual({ allowed: false, reason: 'different_market' });
  });

  it('refuses a currency mismatch even within one market', () => {
    expect(canRedeemCredit({ ...base, creditCurrency: 'ARS' }))
      .toEqual({ allowed: false, reason: 'different_currency' });
  });

  // Credit can only discharge against a payment the platform actually settles.
  // Against a seller's own external checkout we never see the money, so there is
  // nothing to net the liability off against.
  it('refuses rails the platform does not settle', () => {
    expect(canRedeemCredit({ ...base, paymentRail: 'seller_external_checkout' }))
      .toEqual({ allowed: false, reason: 'unsupported_payment_rail' });
  });

  it('accepts the platform wallet as a settling rail', () => {
    expect(canRedeemCredit({ ...base, paymentRail: 'platform_wallet' })).toEqual({ allowed: true });
  });

  it('never lets a redemption exceed the balance', () => {
    expect(canRedeemCredit({ ...base, amountMinor: 100_001 }))
      .toEqual({ allowed: false, reason: 'insufficient_balance' });
    expect(canRedeemCredit({ ...base, amountMinor: 100_000 })).toEqual({ allowed: true });
  });

  it('rejects zero and negative redemptions', () => {
    expect(canRedeemCredit({ ...base, amountMinor: 0 }).allowed).toBe(false);
    expect(canRedeemCredit({ ...base, amountMinor: -1 }).allowed).toBe(false);
  });

  it('checks the market before anything else, so the reason is the real one', () => {
    const wrongEverything = {
      ...base,
      purchaseMarketCode: 'AR',
      purchaseCurrency: 'ARS',
      amountMinor: 999_999_999,
    };
    expect(canRedeemCredit(wrongEverything)).toEqual({ allowed: false, reason: 'different_market' });
  });
});

describe('unconfigured markets', () => {
  // marketConfig() resolves anything unknown to the default market, which is
  // right for rendering and catastrophic for a money guard: it would let credit
  // cross a border by way of a typo. The guard compares raw codes instead.
  it('does not resolve an unknown market to the default one', () => {
    expect(canRedeemCredit({ ...base, purchaseMarketCode: 'ZZ' }))
      .toEqual({ allowed: false, reason: 'different_market' });
  });

  it('rejects a blank market rather than defaulting it', () => {
    expect(canRedeemCredit({ ...base, purchaseMarketCode: '   ' }))
      .toEqual({ allowed: false, reason: 'different_market' });
  });

  it('compares market codes case-insensitively', () => {
    expect(canRedeemCredit({ ...base, purchaseMarketCode: 'mx' })).toEqual({ allowed: true });
  });
});
