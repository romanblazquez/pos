// Single source of truth for canonical host + brand identity.
//
// Canonical host policy (spec §14): ONE public host. We pick the apex
// `juegospedia.com`. `www.` and `app.` should 301 to it at the proxy layer.
// Override per-environment with NEXT_PUBLIC_SITE_URL (no trailing slash).
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://juegospedia.com'
).replace(/\/$/, '');

// Server-side catalog API. Reached internally in Docker, or publicly in dev.
export const API_BASE_URL = (
  process.env.API_BASE_URL ?? 'https://api.juegospedia.com'
).replace(/\/$/, '');

export const SITE_NAME = 'Juegospedia';

/**
 * Search Console / Bing ownership tokens.
 *
 * The site went live to crawlers without these, which means it was indexed but
 * unobservable: no way to submit the sitemap, see which URLs Google rejected, or
 * find out that a page stopped ranking. Empty is a valid state — the tag is only
 * emitted when a token is configured, so an unset env var leaves the head clean
 * rather than shipping `content=""`.
 */
export const GOOGLE_SITE_VERIFICATION = (process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '').trim();
export const BING_SITE_VERIFICATION = (process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? '').trim();

// GA4 Measurement ID. Public by design (it ships in client HTML). Always on for
// now — no consent gate, ad signals stay off. Override via env per-environment.
export const GA_MEASUREMENT_ID = (
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-TYVHMB01K1'
).trim();

// The transactional SPA (cart / checkout / account) stays on its own host after
// the apex cutover. Public SSR pages hand off here to complete a purchase.
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.juegospedia.com').replace(
  /\/$/,
  '',
);

export const ORGANIZATION = {
  name: SITE_NAME,
  legalName: 'Juegospedia',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
};

// ISR revalidation windows (seconds). Prices/stock change often, so product
// pages revalidate faster; taxonomy pages are stabler. On-demand revalidation
// (Phase 3) will invalidate these immediately on catalog/price/stock webhooks.
export const REVALIDATE = {
  product: 60 * 15,
  category: 60 * 30,
  listing: 60 * 30,
  home: 60 * 30,
} as const;

export function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
