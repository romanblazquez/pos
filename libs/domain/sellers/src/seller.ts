export type SellerTier = 'starter' | 'growth' | 'pro' | 'platform';
export type SellerStatus = 'pending' | 'active' | 'suspended' | 'churned';
export type ConnectorType =
  | 'tiendanube'
  | 'shopify'
  | 'mercadolibre'
  | 'woocommerce'
  | 'odoo'
  | 'csv'
  | 'manual'
  | 'platform';

export interface Seller {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  country: string;
  timezone: string;
  logoUrl?: string;
  description?: string;
  connectorType?: ConnectorType;
  tier: SellerTier;
  status: SellerStatus;
  commissionRate: number; // decimal, e.g. 0.03 = 3%
  score?: SellerScore;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerScore {
  sellerId: string;
  fulfillmentRate: number;    // 0–1
  cancellationRate: number;   // 0–1
  stockAccuracy: number;      // 0–1
  responseTimeHours: number;
  customerSvcScore: number;   // 1–5
  catalogCompleteness: number; // 0–1
  integrationHealth: number;  // 0–1
  compositeScore: number;     // 0–1, weighted
  scoredAt: Date;
}

export interface CreateSellerDto {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  timezone?: string;
}

export interface UpdateSellerDto {
  name?: string;
  phone?: string;
  logoUrl?: string;
  description?: string;
  connectorType?: ConnectorType;
  tier?: SellerTier;
  status?: SellerStatus;
  commissionRate?: number;
}

export interface SellerOnboardingStep {
  step: string;
  data: Record<string, unknown>;
}
