/**
 * Which offers a given market is allowed to show.
 *
 * One market, one currency. A comparison page that mixes MXN and ARS rows is not
 * a comparison — the numbers are not on the same scale, "cheapest" becomes
 * meaningless, and the shopper is quoted money they cannot pay in a country the
 * seller may not ship to.
 *
 * `Listing` carries no market or country column today; the only trustworthy
 * market signal on an offer is the currency the seller chose to quote in. A
 * seller pricing in MXN is selling into Mexico. That is a proxy, and it is
 * recorded as one — when offers gain an explicit market link (the
 * `commerce_market` work), this is the single place that has to change.
 *
 * Deliberately NOT inferred from `seller_market`: exactly one such row exists in
 * production and it claims its seller ships only to AR while that seller carries
 * 50 active MXN listings, so joining through it would empty the catalogue.
 */

/** Markets the routing layer serves, keyed by uppercase market code. */
export interface MarketCommerceConfig {
  code: string;
  countryCode: string;
  canonicalCurrency: string;
}

/**
 * Seller statuses whose offers may be shown publicly.
 *
 * `pending` sellers have not been reviewed, `suspended` are banned and
 * `churned` have left — none of them should appear in a price comparison.
 */
export const SELLER_VISIBLE_STATUS = 'active';

export const MARKET_COMMERCE: Readonly<Record<string, MarketCommerceConfig>> = {
  MX: { code: 'MX', countryCode: 'MX', canonicalCurrency: 'MXN' },
  AR: { code: 'AR', countryCode: 'AR', canonicalCurrency: 'ARS' },
};

export const DEFAULT_MARKET_CODE = 'MX';

export function marketConfig(code?: string | null): MarketCommerceConfig {
  const key = (code ?? DEFAULT_MARKET_CODE).toUpperCase();
  return MARKET_COMMERCE[key] ?? MARKET_COMMERCE[DEFAULT_MARKET_CODE];
}

/** The currency offers must be quoted in to appear in this market. */
export function marketCurrency(code?: string | null): string {
  return marketConfig(code).canonicalCurrency;
}

/**
 * Prisma `where` fragment selecting the offers eligible for a market.
 * Compose with the caller's own filters rather than replacing them.
 *
 * Two conditions, both required:
 *
 *  1. The seller has DECLARED this market — an active `SellerMarket` linked to
 *     the `CommerceMarket`. This is the authoritative signal: a seller decides
 *     which markets they serve, we do not infer it for them.
 *  2. The offer is quoted in the market's canonical currency. Kept as a guard
 *     rather than dropped, so a seller who declares Mexico but prices a listing
 *     in pesos argentinos cannot put that price on a Mexican page.
 */
export function eligibleListingWhere(marketCode?: string | null) {
  return {
    active: true,
    currency: marketCurrency(marketCode),
    seller: {
      // A suspended seller disappears from comparison entirely. Without this,
      // "ban this seller" changed a status column and nothing else — their
      // offers kept competing on every product page.
      status: SELLER_VISIBLE_STATUS,
      canonicalMarkets: {
        some: {
          active: true,
          commerceMarket: { code: marketConfig(marketCode).code, active: true },
        },
      },
    },
  };
}

/**
 * Offers that exist for this product somewhere other than the requested market.
 *
 * Filtering must not produce a dead end: when a game has no local offer we still
 * know it is stocked elsewhere, and saying so is more useful than an empty page.
 * Counts only — never prices, because a price in another market's currency is
 * not an offer to this shopper and must not read like one.
 */
export interface ForeignAvailability {
  /** Distinct currencies this product is listed in outside the market. */
  currencies: string[];
  /** How many active offers exist outside the market. */
  offerCount: number;
}

export function summariseForeignAvailability(
  listings: ReadonlyArray<{ currency: string; active?: boolean }>,
  marketCode?: string | null,
): ForeignAvailability {
  const local = marketCurrency(marketCode);
  const foreign = listings.filter((l) => l.active !== false && l.currency !== local);
  return {
    currencies: [...new Set(foreign.map((l) => l.currency))].sort(),
    offerCount: foreign.length,
  };
}

/**
 * Blank a listing card's price when it is not quoted in this market's currency.
 *
 * The product itself STAYS in results. A globally catalogued game must remain
 * discoverable even where nobody sells it — hiding it would shrink the
 * catalogue to the ~4% of products that currently have any offer at all. What
 * must not survive is the price: an ARS amount rendered on a Mexican listing
 * page is the same defect as on a product page, just harder to notice in a grid.
 *
 * The card then falls through to its "no offer" state, which is the truth for
 * this market.
 */
export function withMarketPricing<
  T extends { minPriceMinor?: number; maxPriceMinor?: number; currency?: string },
>(product: T, marketCode?: string | null): T & { availableElsewhere?: boolean } {
  // The search index stores '' for a product with no offers, or offers in
  // several currencies. Normalise it away here so no client ever receives an
  // empty currency string — one of them fed it straight to Intl.NumberFormat,
  // which throws and took down the whole page.
  if (product.currency === '') return { ...product, currency: undefined };
  if (!product.currency || product.currency === marketCurrency(marketCode)) return product;
  // `availableElsewhere` distinguishes "nobody sells this" from "sold, but not
  // here". Both have no local price; only one of them is worth telling the
  // shopper about, and conflating them wastes the most useful signal we have.
  return {
    ...product,
    minPriceMinor: 0,
    maxPriceMinor: 0,
    currency: undefined,
    availableElsewhere: true,
  };
}
