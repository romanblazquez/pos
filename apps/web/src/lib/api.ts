// Typed catalog client. Mirrors the real retail-api contract used by the SPA:
//   GET /api/v1/products/{slug}        -> ProductDetail
//   GET /api/v1/products?q&category&…  -> { results: ProductSummary[]; total }
//   GET /api/v1/products/categories    -> { category; count }[]
//
// Server-only (App Router server components). ISR is driven by per-request
// `next.revalidate`; Phase 3 adds cache tags + on-demand revalidation.
import { API_BASE_URL, REVALIDATE } from './site';

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

async function api<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate },
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
export function getProduct(slug: string, locale?: string): Promise<ProductDetail | null> {
  const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
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
  complexity?: string;
  /** UI locale for name/description overrides; without it cards show base English. */
  locale?: string;
  /** Meaning-based retrieval for unfiltered natural-language searches. */
  semantic?: boolean;
}): Promise<{ results: ProductSummary[]; total: number }> {
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
  for (const mechanic of opts.mechanics ?? []) params.append('mechanics', mechanic);
  const data = await api<{ results: ProductSummary[]; total: number }>(
    `/api/v1/products?${params}`,
    REVALIDATE.listing,
  );
  return data ?? { results: [], total: 0 };
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

// Best (lowest) in-stock price across listings, else lowest overall.
export function bestOffer(listings: Listing[]): Listing | null {
  if (!listings.length) return null;
  const inStock = listings.filter((l) => l.stock > 0);
  const pool = inStock.length ? inStock : listings;
  return pool.reduce((a, b) => (b.priceMinorUnits < a.priceMinorUnits ? b : a));
}
