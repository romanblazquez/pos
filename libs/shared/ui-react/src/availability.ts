

/**
 * What we can honestly say about buying this product in this market.
 *
 * Three states, because the catalogue is much larger than the supply: 2,207
 * enriched products against roughly 100 with a live offer. The states exist so
 * a page never has to choose between claiming something false and saying
 * nothing — saying nothing is what a shopper reads as "broken", and what a
 * crawler reads as a thin page.
 *
 *  - `available`      — real offers in this market's currency; show them.
 *  - `no_local_offer` — nothing here, but sellers abroad stock it. Say so in
 *                       counts, never in foreign prices.
 *  - `catalogue_only` — nobody we know of sells it anywhere. The encyclopedia
 *                       entry is still genuinely useful; the page says plainly
 *                       that it is not for sale rather than implying it is.
 */
export type AvailabilityState = 'available' | 'no_local_offer' | 'catalogue_only';

/**
 * Derived in one place so the page copy, the availability notice and the
 * structured data can never disagree about whether this product is for sale.
 *
 * Listings arriving here are already market-scoped by the API, so their mere
 * presence means "buyable in this market".
 */
export interface AvailabilityInput {
  listings?: Array<{ priceMinorUnits: number }> | null;
  foreignAvailability?: { currencies: string[]; offerCount: number } | null;
}

export function availabilityState(product: AvailabilityInput): AvailabilityState {
  const sellable = (product.listings ?? []).filter((listing) => listing.priceMinorUnits > 0);
  if (sellable.length > 0) return 'available';
  if ((product.foreignAvailability?.offerCount ?? 0) > 0) return 'no_local_offer';
  return 'catalogue_only';
}
