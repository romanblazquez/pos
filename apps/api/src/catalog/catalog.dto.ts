export interface UpsertProductDto {
  sku: string;
  name: string;
  barcode?: string;
  category: string;
  photoUrl?: string;
  priceMinorUnits: number;
  currency?: string;
  taxRatePercent?: number;
  trackInventory?: boolean;
  active?: boolean;
  sourceType?: string;
  sourceId?: string;
}

export interface ProductFilters {
  category?: string;
  active?: boolean;
  sourceType?: string;
  search?: string;
}
