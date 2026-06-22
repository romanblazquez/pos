import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, LOCALES, segmentFor } from '@/lib/segments';

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
    url.pathname = `/${DEFAULT_LOCALE}/${segmentFor('games', DEFAULT_LOCALE)}/${legacyProduct[1]}`;
    return NextResponse.redirect(url, 301);
  }
  if (pathname === '/search') {
    const url = req.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}/${segmentFor('search', DEFAULT_LOCALE)}`;
    return NextResponse.redirect(url, 301);
  }
  // Account/cart/checkout now live on the SPA host — send legacy paths there.
  if (/^\/(account|cart|checkout|wallet|orders|addresses)(\/|$)/.test(pathname)) {
    return NextResponse.redirect(`${APP_HOST}${pathname}${req.nextUrl.search}`, 301);
  }

  // Locale prefix required: redirect bare paths to the default locale.
  const first = pathname.split('/')[1];
  if (!LOCALES.includes(first as (typeof LOCALES)[number])) {
    const url = req.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
