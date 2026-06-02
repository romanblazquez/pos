import { Money, type ProductId, type CurrencyCode } from '@retail-os/shared-kernel';

/**
 * Product — a sellable item in the catalog bounded context.
 *
 * `unitPrice` is the **net** (tax-exclusive) price; the applicable tax rate is
 * carried as `taxRatePercent` (e.g. 16 for Mexican IVA) and applied by the
 * sales context. A product may have a primary `barcode` used for scan lookups.
 */
export interface Product {
  readonly id: ProductId;
  readonly sku: string;
  readonly name: string;
  readonly barcode?: string;
  readonly category: string;
  readonly unitPrice: Money;
  readonly taxRatePercent: number;
  readonly trackInventory: boolean;
  readonly active: boolean;
}

export interface ProductSnapshot {
  id: string;
  sku: string;
  name: string;
  barcode?: string;
  category: string;
  priceMinorUnits: number;
  currency: CurrencyCode;
  taxRatePercent: number;
  trackInventory: boolean;
  active: boolean;
}

export function productFromSnapshot(s: ProductSnapshot): Product {
  return {
    id: s.id as ProductId,
    sku: s.sku,
    name: s.name,
    barcode: s.barcode,
    category: s.category,
    unitPrice: Money.of(s.priceMinorUnits, s.currency),
    taxRatePercent: s.taxRatePercent,
    trackInventory: s.trackInventory,
    active: s.active,
  };
}

export function productToSnapshot(p: Product): ProductSnapshot {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    barcode: p.barcode,
    category: p.category,
    priceMinorUnits: p.unitPrice.minorUnits,
    currency: p.unitPrice.currency,
    taxRatePercent: p.taxRatePercent,
    trackInventory: p.trackInventory,
    active: p.active,
  };
}
