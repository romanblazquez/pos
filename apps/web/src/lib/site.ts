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
