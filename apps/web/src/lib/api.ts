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

export function getProduct(slug: string): Promise<ProductDetail | null> {
  return api<ProductDetail>(`/api/v1/products/${encodeURIComponent(slug)}`, REVALIDATE.product);
}

export async function listProducts(opts: {
  category?: string;
  q?: string;
  limit?: number;
  offset?: number;
  inStock?: boolean;
}): Promise<{ results: ProductSummary[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(opts.limit ?? 24),
    offset: String(opts.offset ?? 0),
  });
  if (opts.q) params.set('q', opts.q);
  if (opts.category) params.set('category', opts.category);
  if (opts.inStock) params.set('inStock', 'true');
  const data = await api<{ results: ProductSummary[]; total: number }>(
    `/api/v1/products?${params}`,
    REVALIDATE.listing,
  );
  return data ?? { results: [], total: 0 };
}

export async function getCategories(): Promise<CategoryCount[]> {
  return (await api<CategoryCount[]>(`/api/v1/products/categories`, REVALIDATE.category)) ?? [];
}

// Best (lowest) in-stock price across listings, else lowest overall.
export function bestOffer(listings: Listing[]): Listing | null {
  if (!listings.length) return null;
  const inStock = listings.filter((l) => l.stock > 0);
  const pool = inStock.length ? inStock : listings;
  return pool.reduce((a, b) => (b.priceMinorUnits < a.priceMinorUnits ? b : a));
}
