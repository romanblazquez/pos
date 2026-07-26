import { BrowserApiClient } from '@retail-os/api-client';

export const API_BASE = import.meta.env.VITE_API_URL ?? '';
export const marketplaceApi = new BrowserApiClient(API_BASE, 'marketplace');

/**
 * The market code every product request must carry.
 *
 * Read from the same cookie the market picker writes, so it is available to
 * plain fetch helpers that run outside React and cannot call useMarket().
 * Product endpoints are market-scoped on the server: omitting this returns the
 * default market's offers, which is how Argentine prices appeared on pages a
 * Mexican shopper was reading.
 */
export const MARKET_COOKIE = 'jp-market';
export const DEFAULT_MARKET_CODE = 'MX';

export function activeMarketCode(): string {
  if (typeof document === 'undefined') return DEFAULT_MARKET_CODE;
  const match = document.cookie.match(/(?:^|;\s*)jp-market=([A-Za-z]{2})(?:;|$)/);
  return (match?.[1] ?? DEFAULT_MARKET_CODE).toUpperCase();
}

/**
 * Append the active market to a product query. Use for EVERY product endpoint —
 * search, home, similar, detail — so no surface can silently fall back to the
 * default market's prices.
 */
export function withMarket(params: URLSearchParams): URLSearchParams {
  params.set('market', activeMarketCode());
  return params;
}
