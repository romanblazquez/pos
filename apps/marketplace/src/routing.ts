// Pure URL <-> route mapping for the marketplace SPA. Extracted from App.tsx so
// the search contract — the query is initialized from the URL and the URL is the
// single, canonical, shareable source of truth — is unit-testable without a DOM.

export type Route =
  | { page: 'home' }
  | { page: 'search'; q: string; category?: string }
  | { page: 'product'; slug: string }
  | { page: 'account' }
  | { page: 'wallet' }
  | { page: 'orders' }
  | { page: 'addresses' };

/** URL -> Route. Drives both initial load and browser back/forward (popstate). */
export function parseRoute(pathname: string, search: string): Route {
  if (pathname.startsWith('/product/')) {
    const slug = pathname.slice('/product/'.length);
    if (slug) return { page: 'product', slug };
  }
  if (pathname === '/search') {
    const params = new URLSearchParams(search);
    return {
      page: 'search',
      q: params.get('q') ?? '',
      category: params.get('category') ?? undefined,
    };
  }
  if (pathname === '/account') return { page: 'account' };
  if (pathname === '/account/wallet') return { page: 'wallet' };
  if (pathname === '/account/orders') return { page: 'orders' };
  if (pathname === '/account/addresses') return { page: 'addresses' };
  return { page: 'home' };
}

/** Route -> canonical path. URLSearchParams encodes the query consistently, so
 *  a given query always maps to exactly one URL. */
export function routePath(r: Route): string {
  if (r.page === 'search') {
    const params = new URLSearchParams();
    if (r.q) params.set('q', r.q);
    if (r.category) params.set('category', r.category);
    const query = params.toString();
    return query ? `/search?${query}` : '/search';
  }
  if (r.page === 'product') return `/product/${r.slug}`;
  if (r.page === 'account') return '/account';
  if (r.page === 'wallet') return '/account/wallet';
  if (r.page === 'orders') return '/account/orders';
  if (r.page === 'addresses') return '/account/addresses';
  return '/';
}
