import { marketCurrency } from './market-eligibility.js';

/**
 * When cashback credit may be redeemed.
 *
 * Credit is a liability the platform owes, denominated in the currency of the
 * market it was earned in. Spending it in another market would make the platform
 * absorb the FX spread and would move value across a tax border with no
 * corresponding transaction — so redemption requires the market, the currency
 * and the payment rail to line up with where the credit came from.
 *
 * Deliberately a pure function: the rule is asserted in one place, tested
 * directly, and cannot drift between the checkout path and any admin tool.
 */

export type CreditRejection =
  | 'different_market'
  | 'different_currency'
  | 'unsupported_payment_rail'
  | 'insufficient_balance'
  | 'non_positive_amount';

export interface CreditRedemptionRequest {
  /** Market the credit balance belongs to. */
  creditMarketCode: string;
  creditCurrency: string;
  balanceMinor: number;
  /** Market the purchase is being made in. */
  purchaseMarketCode: string;
  purchaseCurrency: string;
  amountMinor: number;
  /**
   * Rail the purchase settles through. Credit is only redeemable where the
   * platform actually participates in settlement — otherwise we would be
   * discharging a liability against a payment we never see.
   */
  paymentRail: string;
}

export type CreditRedemptionResult =
  | { allowed: true }
  | { allowed: false; reason: CreditRejection };

/**
 * Rails the platform settles through and can therefore discharge credit against.
 * Anything else (a seller's own external checkout, a bank transfer we never
 * observe) cannot consume credit, because we have no way to net it off.
 */
export const REDEEMABLE_PAYMENT_RAILS: readonly string[] = ['mercadopago', 'platform_wallet'];

export function canRedeemCredit(request: CreditRedemptionRequest): CreditRedemptionResult {
  if (request.amountMinor <= 0) {
    return { allowed: false, reason: 'non_positive_amount' };
  }

  // Compare the codes as given, NOT through marketConfig(): that resolver falls
  // back to the default market for anything unconfigured, which would quietly
  // turn an unknown market into MX and let credit cross a border it must not.
  // A lookup convenience must never soften a financial guard.
  const creditMarket = request.creditMarketCode.trim().toUpperCase();
  const purchaseMarket = request.purchaseMarketCode.trim().toUpperCase();
  if (!creditMarket || !purchaseMarket || creditMarket !== purchaseMarket) {
    return { allowed: false, reason: 'different_market' };
  }

  // Belt and braces: the market's canonical currency is authoritative, but a
  // stored balance carries its own currency and both must agree. A mismatch
  // means the balance predates a market's currency changing, and spending it
  // would silently revalue the platform's debt.
  const expected = marketCurrency(request.purchaseMarketCode);
  if (
    request.creditCurrency.toUpperCase() !== request.purchaseCurrency.toUpperCase() ||
    request.creditCurrency.toUpperCase() !== expected.toUpperCase()
  ) {
    return { allowed: false, reason: 'different_currency' };
  }

  if (!REDEEMABLE_PAYMENT_RAILS.includes(request.paymentRail)) {
    return { allowed: false, reason: 'unsupported_payment_rail' };
  }

  if (request.amountMinor > request.balanceMinor) {
    return { allowed: false, reason: 'insufficient_balance' };
  }

  return { allowed: true };
}
