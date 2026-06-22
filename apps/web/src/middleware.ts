import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/segments';

// Edge concerns (spec §2, §14):
//  - `/` and any non-localized top path -> redirect to the default locale.
//  - Enforce lowercase paths (one canonical casing) with a 301.
// Host canonicalization (www/app -> apex) and http->https are handled at the
// Traefik/Cloudflare layer, not here.
const PUBLIC_FILE = /\.[^/]+$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
