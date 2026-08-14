// Typed catalog client. Mirrors the real retail-api contract used by the SPA:
//   GET /api/v1/products/{slug}        -> ProductDetail
//   GET /api/v1/products?q&category&…  -> { results: ProductSummary[]; total }
//   GET /api/v1/products/categories    -> { category; count }[]
//
// Server-only (App Router server components). ISR is driven by per-request
// `next.revalidate`; Phase 3 adds cache tags + on-demand revalidation.
import { API_BASE_URL, REVALIDATE } from './site';
import type { Locale } from './segments';

export interface DeliveryOption {
  id: string;
  name: string;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  priceMinorUnits: number;
  type: string;
}

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerSlug: string;
  sellerScore: number;
  priceMinorUnits: number;
  currency: string;
  stock: number;
  stockStatus: string;
  deliveryOptions: DeliveryOption[];
  lastSyncedAt: string;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  category: string;
  categories?: Array<{ slug: string; name: string; isPrimary: boolean }>;
  description?: string;
  images: string[];
  publisher?: string;
  designer?: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  minAge?: number;
  playTimeMinutes?: number;
  language?: string;
  bggId?: string;
  bggRating?: number;
  bggWeight?: number;
  tags: string[];
  listings: Listing[];
  /** Market these offers were selected for, and the currency they are quoted in. */
  marketCode?: string;
  marketCurrency?: string;
  /**
   * Offers that exist for this product OUTSIDE the current market. Counts and
   * currencies only — never prices, because an amount in another market's
   * currency is not an offer to this shopper.
   */
  foreignAvailability?: { currencies: string[]; offerCount: number };
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  images: string[];
  category: string;
  tags: string[];
  description?: string;
  publisher?: string;
  minPlayers?: number;
  maxPlayers?: number;
  minAge?: number;
  playTimeMinutes?: number;
  minPriceMinor: number;
  maxPriceMinor: number;
  /**
   * Currency the price range is denominated in. Absent when the product has no
   * listings, or when its listings span several currencies — in which case
   * there is no single range to quote and callers must not invent one.
   */
  currency?: string;
  /**
   * True when this product HAS offers, just not in the current market. Distinct
   * from having no offers at all: one is worth surfacing, the other is not.
   */
  availableElsewhere?: boolean;
  totalListings: number;
  inStockListings: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface MechanicCount {
  mechanic: string;
  count: number;
}

export interface CatalogFacets {
  publishers: Array<{ value: string; count: number }>;
  years: Array<{ value: number; count: number }>;
  ages: Array<{ value: number; count: number }>;
  durations: Array<{ value: number; count: number }>;
}

export interface Seller {
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  productCount: number;
}

/**
 * `revalidate` in seconds, or 'fresh' to bypass Next's fetch data cache
 * entirely. The sitemap needs 'fresh': it derives how many pages of the
 * catalogue to walk from the first response's `total`, so a cached total
 * silently truncates the whole file to whatever the catalogue size was when
 * that entry was written.
 */
async function api<T>(path: string, revalidate: number | 'fresh'): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...(revalidate === 'fresh' ? { cache: 'no-store' as const } : { next: { revalidate } }),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// `locale` selects the API's approved title/description override (es-MX / en-US);
// without it the API falls back to the base English BGG text, so always pass it.
export function getProduct(
  slug: string,
  locale?: string,
  market?: string,
): Promise<ProductDetail | null> {
  const params = new URLSearchParams();
  if (locale) params.set('locale', locale);
  // Always send the market: offers are market-scoped, and an omitted market
  // would silently fall back to the default one's currency.
  if (market) params.set('market', market.toUpperCase());
  const qs = params.toString() ? `?${params}` : '';
  return api<ProductDetail>(`/api/v1/products/${encodeURIComponent(slug)}${qs}`, REVALIDATE.product);
}

export type SortBy = 'rank_score' | 'price_asc' | 'price_desc' | 'name';

export async function listProducts(opts: {
  category?: string;
  publisher?: string;
  yearPublished?: number;
  minAge?: number;
  playTimeMinutes?: number;
  q?: string;
  limit?: number;
  offset?: number;
  inStock?: boolean;
  minPlayers?: number;
  sortBy?: SortBy;
  /** Price bounds in MINOR units (centavos), matching the API contract. */
  minPriceMinor?: number;
  maxPriceMinor?: number;
  mechanics?: string[];
  /** Filter to products with an active listing from this seller (slug). */
  seller?: string;
  /** Bypass the fetch data cache — see `api()`. Used by the sitemap. */
  fresh?: boolean;
  complexity?: string;
  /** UI locale for name/description overrides; without it cards show base English. */
  locale?: string;
  /** Meaning-based retrieval for unfiltered natural-language searches. */
  semantic?: boolean;
  /** Market whose offers may be priced; others fall back to "no offer". */
  market?: string;
  /**
   * Show only products offered in these currencies, at the seller's own price.
   * A filter, not a converter — nothing is restated in another currency.
   */
  currencies?: string[];
}): Promise<{ results: ProductSummary[]; total: number; source?: string }> {
  const params = new URLSearchParams({
    limit: String(opts.limit ?? 24),
    offset: String(opts.offset ?? 0),
  });
  if (opts.locale) params.set('locale', opts.locale);
  if (opts.q) params.set('q', opts.q);
  if (opts.semantic) params.set('semantic', 'true');
  if (opts.category) params.set('category', opts.category);
  if (opts.publisher) params.set('publisher', opts.publisher);
  if (opts.yearPublished) params.set('yearPublished', String(opts.yearPublished));
  if (opts.minAge) params.set('minAge', String(opts.minAge));
  if (opts.playTimeMinutes) params.set('playTimeMinutes', String(opts.playTimeMinutes));
  if (opts.inStock) params.set('inStock', 'true');
  if (opts.minPlayers) params.set('minPlayers', String(opts.minPlayers));
  if (opts.sortBy) params.set('sortBy', opts.sortBy);
  if (opts.minPriceMinor) params.set('minPrice', String(opts.minPriceMinor));
  if (opts.maxPriceMinor) params.set('maxPrice', String(opts.maxPriceMinor));
  if (opts.complexity) params.set('complexity', opts.complexity);
  if (opts.market) params.set('market', opts.market.toUpperCase());
  for (const currency of opts.currencies ?? []) params.append('currency', currency.toUpperCase());
  for (const mechanic of opts.mechanics ?? []) params.append('mechanics', mechanic);
  if (opts.seller) params.set('seller', opts.seller);
  const data = await api<{ results: ProductSummary[]; total: number; source?: string }>(
    `/api/v1/products?${params}`,
    opts.fresh ? 'fresh' : REVALIDATE.listing,
  );
  return data ?? { results: [], total: 0 };
}

/**
 * Games a shopper who is looking at this one might also want.
 *
 * Server-rendered rather than fetched in the browser: these are crawlable
 * internal links between product pages, which is how a catalogue of 21,000
 * pages passes authority around instead of leaving every page an island.
 */
export async function listSimilar(
  slug: string,
  locale: Locale,
  market?: string,
): Promise<ProductSummary[]> {
  const params = new URLSearchParams({ locale, ...(market ? { market } : {}) });
  return (
    (await api<ProductSummary[]>(
      `/api/v1/products/${encodeURIComponent(slug)}/similar?${params}`,
      REVALIDATE.product,
    )) ?? []
  );
}

export async function getCategories(): Promise<CategoryCount[]> {
  return (await api<CategoryCount[]>(`/api/v1/products/categories`, REVALIDATE.category)) ?? [];
}

export async function getMechanics(): Promise<MechanicCount[]> {
  return (await api<MechanicCount[]>(`/api/v1/products/mechanics`, REVALIDATE.category)) ?? [];
}

export async function getCatalogFacets(): Promise<CatalogFacets> {
  return (await api<CatalogFacets>(`/api/v1/products/facets`, REVALIDATE.category)) ?? {
    publishers: [], years: [], ages: [], durations: [],
  };
}

export async function getSellers(): Promise<Seller[]> {
  return (await api<Seller[]>(`/api/v1/products/sellers`, REVALIDATE.category)) ?? [];
}

export function getSeller(slug: string): Promise<Seller | null> {
  return api<Seller>(`/api/v1/products/sellers/${encodeURIComponent(slug)}`, REVALIDATE.category);
}

// Best (lowest) in-stock price across listings, else lowest overall.
export function bestOffer(listings: Listing[]): Listing | null {
  if (!listings.length) return null;
  const inStock = listings.filter((l) => l.stock > 0);
  const pool = inStock.length ? inStock : listings;
  return pool.reduce((a, b) => (b.priceMinorUnits < a.priceMinorUnits ? b : a));
}
