import { describe, expect, it } from 'vitest';
import { parseRoute, routePath, type Route } from './routing.js';

describe('marketplace routing — search is URL-driven and canonical', () => {
  it('initializes the query from the URL (?q=)', () => {
    expect(parseRoute('/search', '?q=Ancient')).toEqual({
      page: 'search',
      q: 'Ancient',
      category: undefined,
    });
  });

  it('treats a missing q as an empty query, not undefined', () => {
    expect(parseRoute('/search', '')).toEqual({ page: 'search', q: '', category: undefined });
  });

  it('URL-decodes the query (spaces, symbols)', () => {
    expect(parseRoute('/search', '?q=2%20jugadores%20%26%20co')).toMatchObject({ q: '2 jugadores & co' });
    // `+` is the form-encoding for a space, which is what routePath emits.
    expect(parseRoute('/search', '?q=catan+duel')).toMatchObject({ q: 'catan duel' });
  });

  it('parses an optional category alongside the query', () => {
    expect(parseRoute('/search', '?q=catan&category=board-game')).toEqual({
      page: 'search',
      q: 'catan',
      category: 'board-game',
    });
  });

  it('back/forward (popstate) re-parses whatever the URL says', () => {
    // popstate handing us a bare /search must clear the query, not keep a stale one.
    expect(parseRoute('/search', '?q=old')).toMatchObject({ q: 'old' });
    expect(parseRoute('/search', '')).toMatchObject({ q: '' });
  });

  it('builds one canonical, encoded URL per query', () => {
    expect(routePath({ page: 'search', q: 'Ancient' })).toBe('/search?q=Ancient');
    expect(routePath({ page: 'search', q: 'catan & co' })).toBe('/search?q=catan+%26+co');
  });

  it('omits the query string for an empty search', () => {
    expect(routePath({ page: 'search', q: '' })).toBe('/search');
  });

  it('round-trips query and category through URL and back', () => {
    const route: Route = { page: 'search', q: '2 jugadores', category: 'board-game' };
    const url = routePath(route);
    const [pathname, search] = url.split('?');
    expect(parseRoute(pathname, search ? `?${search}` : '')).toEqual(route);
  });

  it('maps non-search routes without a query string', () => {
    expect(routePath({ page: 'product', slug: 'catan-13' })).toBe('/product/catan-13');
    expect(parseRoute('/product/catan-13', '')).toEqual({ page: 'product', slug: 'catan-13' });
    expect(parseRoute('/', '')).toEqual({ page: 'home' });
  });
});
