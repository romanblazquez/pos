import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * Same-origin proxy for "tell me when this is available".
 *
 * The browser posts here rather than straight to the API because API_BASE_URL is
 * the internal Docker host — unreachable from a page — and going direct to the
 * public API host would need a CORS grant plus a `connect-src` opening in the
 * CSP. Same-origin needs neither, and `robots.txt` already disallows /api/.
 */
export async function POST(request: NextRequest) {
  let body: { slug?: string; email?: string; market?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const upstream = new URL(
    `/api/v1/products/${encodeURIComponent(slug)}/availability-request`,
    API_BASE_URL,
  );

  try {
    const response = await fetch(upstream, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      // Only the fields the endpoint owns — never forward the raw body.
      body: JSON.stringify({ email: body.email, market: body.market, locale: body.locale }),
    });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    // The shopper gave us their address and we lost it. Say so, so they can
    // retry, rather than showing a success state over a dropped request.
    return NextResponse.json({ error: 'upstream_unavailable' }, { status: 502 });
  }
}
