import type { Product } from './product.js';

/**
 * CatalogIndex — in-memory search index over the local product cache.
 *
 * The POS targets product search < 50ms, so search runs entirely in memory
 * against a normalized token map rather than hitting SQLite per keystroke.
 * Lookups by exact barcode are O(1) for instant scan handling.
 */
export class CatalogIndex {
  private readonly byId = new Map<string, Product>();
  private readonly byBarcode = new Map<string, Product>();
  /** lowercased haystack per product for substring search */
  private readonly haystack = new Map<string, string>();

  constructor(products: Product[] = []) {
    for (const p of products) this.add(p);
  }

  add(product: Product): void {
    this.byId.set(product.id, product);
    if (product.barcode) this.byBarcode.set(product.barcode, product);
    this.haystack.set(
      product.id,
      `${product.name} ${product.sku} ${product.category} ${product.barcode ?? ''}`.toLowerCase(),
    );
  }

  size(): number {
    return this.byId.size;
  }

  getById(id: string): Product | undefined {
    return this.byId.get(id);
  }

  /** Exact-match barcode lookup for scanner input. */
  getByBarcode(barcode: string): Product | undefined {
    return this.byBarcode.get(barcode);
  }

  /**
   * Free-text search across name/sku/category/barcode. Returns active products
   * ranked by match position (prefix matches first), capped at `limit`.
   */
  search(query: string, limit = 25): Product[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...this.byId.values()].filter((p) => p.active).slice(0, limit);

    const scored: Array<{ product: Product; score: number }> = [];
    for (const [id, hay] of this.haystack) {
      const idx = hay.indexOf(q);
      if (idx === -1) continue;
      const product = this.byId.get(id)!;
      if (!product.active) continue;
      scored.push({ product, score: idx });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, limit).map((s) => s.product);
  }
}
