import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_LOCALE,
  DEFAULT_MARKET,
  LOCALES,
  localePrefix,
  MARKETS,
  parseLocalePrefix,
  segmentFor,
  type Locale,
} from '@/lib/segments';

// The transactional SPA host (cart/checkout/account live here post-cutover).
const APP_HOST = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.juegospedia.com';

// Edge concerns (spec §2, §14):
//  - `/` and any non-localized top path -> redirect to the default locale.
//  - Enforce lowercase paths (one canonical casing) with a 301.
// Host canonicalization (www/app -> apex) and http->https are handled at the
// Traefik/Cloudflare layer, not here.
const PUBLIC_FILE = /\.[^/]+$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Host canonicalization: www -> apex (one canonical host, spec §14).
  const host = req.headers.get('host');
  if (host === 'www.juegospedia.com') {
    return NextResponse.redirect(`https://juegospedia.com${pathname}${req.nextUrl.search}`, 301);
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Lowercase enforcement: 301 mixed-case paths to their lowercase form.
  if (pathname !== pathname.toLowerCase()) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 301);
  }

  // ── Legacy SPA URL redirects (apex cutover) ────────────────────────────────
  // Old client-rendered paths 301 to their canonical SSR equivalents so existing
  // links/bookmarks don't 404.
  const legacyProduct = pathname.match(/^\/product\/([^/]+)\/?$/);
  if (legacyProduct) {
    const url = req.nextUrl.clone();
    url.pathname = `/${localePrefix(DEFAULT_LOCALE, DEFAULT_MARKET)}/${segmentFor('games', DEFAULT_LOCALE)}/${legacyProduct[1]}`;
    return NextResponse.redirect(url, 301);
  }
  if (pathname === '/search') {
    const url = req.nextUrl.clone();
    url.pathname = `/${localePrefix(DEFAULT_LOCALE, DEFAULT_MARKET)}/${segmentFor('search', DEFAULT_LOCALE)}`;
    return NextResponse.redirect(url, 301);
  }
  // Account/cart/checkout now live on the SPA host — send legacy paths there.
  if (/^\/(account|cart|checkout|wallet|orders|addresses)(\/|$)/.test(pathname)) {
    return NextResponse.redirect(`${APP_HOST}${pathname}${req.nextUrl.search}`, 301);
  }

  const first = pathname.split('/')[1];

  // ── Language-only legacy prefixes -> language×market (spec: existing-route
  // migration). `/es` and `/en` meant "the Mexican market" for the site's whole
  // life, so they map to the MX market and the rest of the path is preserved.
  // 301 rather than 307: this is a permanent restructure, not a preference.
  if (LOCALES.includes(first as Locale)) {
    const url = req.nextUrl.clone();
    const rest = pathname.slice(first.length + 1);
    url.pathname = `/${localePrefix(first as Locale, DEFAULT_MARKET)}${rest}`;
    return NextResponse.redirect(url, 301);
  }

  // Unknown or missing prefix: send the visitor to their remembered market
  // rather than always to the default one, so a shopper who chose Argentina
  // stays in Argentina when they hit a bare URL.
  //
  // 307 and never cached: the destination depends on a cookie, so a shared
  // cache must not pin one visitor's market onto everyone else's. Crawlers send
  // no cookie and therefore always land on the default market — content served
  // at a given URL stays deterministic for them.
  if (!parseLocalePrefix(first)) {
    const remembered = req.cookies.get('jp-market')?.value?.toLowerCase();
    const market = remembered && MARKETS[remembered] ? remembered : DEFAULT_MARKET;
    const language = req.cookies.get('jp-locale')?.value;
    const locale = language && LOCALES.includes(language as Locale) ? (language as Locale) : DEFAULT_LOCALE;

    const url = req.nextUrl.clone();
    url.pathname = `/${localePrefix(locale, market)}${pathname === '/' ? '' : pathname}`;
    const res = NextResponse.redirect(url, 307);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
