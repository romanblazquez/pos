import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.slice(0, 80) ?? '';
  const limit = request.nextUrl.searchParams.get('limit') ?? '6';
  const upstream = new URL('/api/v1/products/suggestions', API_BASE_URL);
  upstream.searchParams.set('q', q);
  upstream.searchParams.set('limit', limit);

  try {
    const response = await fetch(upstream, { cache: 'no-store', headers: { accept: 'application/json' } });
    if (!response.ok) return NextResponse.json({ products: [], mechanics: [], publishers: [], categories: [] });
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ products: [], mechanics: [], publishers: [], categories: [] });
  }
}
