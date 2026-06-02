import { Money } from '@retail-os/shared-kernel';

/**
 * Promotions — a small, pure rule engine the POS can evaluate against a cart to
 * produce a cart-level discount. Kept deliberately simple for the POS slice; the
 * full campaign/coupon engine (date windows, eligibility, stacking rules) is a
 * backoffice concern on the roadmap.
 */
export type Promotion =
  | { id: string; name: string; kind: 'percentage'; percent: number; minSubtotalMinorUnits?: number }
  | { id: string; name: string; kind: 'fixed'; amountMinorUnits: number; minSubtotalMinorUnits?: number };

export interface PromotionResult {
  promotionId: string;
  name: string;
  discount: Money;
}

/** Evaluate a promotion against a net subtotal, returning the discount (or null). */
export function evaluatePromotion(promo: Promotion, netSubtotal: Money): PromotionResult | null {
  if (promo.minSubtotalMinorUnits && netSubtotal.minorUnits < promo.minSubtotalMinorUnits) {
    return null;
  }
  const discount =
    promo.kind === 'percentage'
      ? netSubtotal.percentage(promo.percent)
      : Money.of(promo.amountMinorUnits, netSubtotal.currency);
  const capped = discount.greaterThan(netSubtotal) ? netSubtotal : discount;
  return { promotionId: promo.id, name: promo.name, discount: capped };
}

/** Pick the single best (largest-discount) eligible promotion — no stacking. */
export function bestPromotion(promos: Promotion[], netSubtotal: Money): PromotionResult | null {
  let best: PromotionResult | null = null;
  for (const p of promos) {
    const r = evaluatePromotion(p, netSubtotal);
    if (r && (!best || r.discount.greaterThan(best.discount))) best = r;
  }
  return best;
}
