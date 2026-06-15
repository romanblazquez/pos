export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
export type ProductCondition = 'new' | 'used' | 'damaged';
export type CanonicalStatus = 'verified' | 'pending' | 'duplicate';
export type DeliveryType = 'standard' | 'express' | 'pickup' | 'same_day';

export interface MktProduct {
  id: string;
  slug: string;
  name: string;
  description?: string;
  images: string[];
  bggId?: string;
  category: string;
  publisher?: string;
  designer?: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  minAge?: number;
  playTimeMinutes?: number;
  language?: string;
  edition?: string;
  condition: ProductCondition;
  tags: string[];
  canonicalStatus: CanonicalStatus;
  bggRating?: number;
  bggWeight?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Listing {
  id: string;
  sellerId: string;
  productId: string;
  sellerSku?: string;
  sellerProductId?: string;
  sellerUrl?: string;
  priceMinorUnits: number;
  currency: string;
  condition: ProductCondition;
  stock: number;
  stockStatus: StockStatus;
  stockConfidence: number; // 0–1
  rankScore: number;       // 0–1, composite
  scoreBreakdown?: ListingScoreBreakdown;
  lastSyncedAt?: Date;
  active: boolean;
  deliveryOptions: DeliveryOption[];
}

export interface ListingScoreBreakdown {
  availability: number;
  priceCompetitiveness: number;
  deliveryScore: number;
  sellerReliability: number;
  sellerQuality: number;
  integrationHealth: number;
}

export interface DeliveryOption {
  id: string;
  listingId: string;
  carrierId?: string;
  name: string;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  priceMinorUnits: number;
  freeThresholdMinor?: number;
  regions: string[];
  type: DeliveryType;
}

export interface ListingWithProduct extends Listing {
  product: MktProduct;
}

export interface CreateListingDto {
  sellerId: string;
  productId: string;
  sellerSku?: string;
  sellerProductId?: string;
  sellerUrl?: string;
  priceMinorUnits: number;
  currency?: string;
  condition?: ProductCondition;
  stock?: number;
  deliveryOptions?: Omit<DeliveryOption, 'id' | 'listingId'>[];
}
