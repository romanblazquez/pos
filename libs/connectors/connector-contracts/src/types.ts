// Shared value types used across all connector interfaces.

export type ConnectorType =
  | 'tiendanube'
  | 'shopify'
  | 'mercadolibre'
  | 'woocommerce'
  | 'odoo'
  | 'csv'
  | 'manual'
  | 'platform';

export type SyncType = 'catalog' | 'inventory' | 'prices' | 'orders';

export type SyncStatus = 'running' | 'success' | 'partial' | 'failed';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';

export type OrderStatus =
  | 'pending'
  | 'reserved'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface ConnectorCredentials {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  shopUrl?: string;
  storeId?: string;
  [key: string]: unknown;
}

export interface HealthCheck {
  ok: boolean;
  message?: string;
  latencyMs?: number;
}

export interface ConnectorCapabilities {
  supportsWebhooks: boolean;
  supportsReservation: boolean;
  supportsDeliveryOptions: boolean;
  supportsPartialStockLevels: boolean;
  // Minimum recommended polling interval in seconds
  minSyncIntervalSeconds: number;
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export interface RawProduct {
  externalId: string;
  sku?: string;
  name: string;
  description?: string;
  images: string[];
  category?: string;
  tags?: string[];
  variants?: RawVariant[];
  // For non-variant products
  priceMinorUnits?: number;
  currency?: string;
  stock?: number;
  url?: string;
}

export interface RawVariant {
  externalId: string;
  sku?: string;
  name: string;
  priceMinorUnits: number;
  currency: string;
  stock: number;
  attributes?: Record<string, string>;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface StockItem {
  externalId: string;
  sku?: string;
  stock: number;
  status: StockStatus;
  warehouseId?: string;
}

// ─── Prices ───────────────────────────────────────────────────────────────────

export interface PriceItem {
  externalId: string;
  sku?: string;
  priceMinorUnits: number;
  originalPriceMinorUnits?: number;
  currency: string;
}

// ─── Reservation ──────────────────────────────────────────────────────────────

export interface ReservationRequest {
  externalProductId: string;
  sku?: string;
  quantity: number;
  orderId: string;
  holdDurationSeconds?: number;
}

export interface ReservationResult {
  reservationId: string;
  expiresAt: Date;
  confirmed: boolean;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrderConfirmation {
  marketplaceOrderId: string;
  reservationId?: string;
  externalProductId: string;
  sku?: string;
  quantity: number;
  unitPriceMinorUnits: number;
  currency: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
  deliveryOptionId?: string;
}

export interface SellerOrderId {
  externalOrderId: string;
}

export interface ExternalOrderStatus {
  externalOrderId: string;
  status: OrderStatus;
  trackingCode?: string;
  trackingUrl?: string;
  estimatedDeliveryAt?: Date;
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export interface WebhookRegistration {
  webhookId: string;
  topic: string;
  callbackUrl: string;
}

export interface PingResult {
  ok: boolean;
  latencyMs: number;
  message?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface OAuthStartResult {
  authUrl: string;
  state: string; // CSRF token to verify on callback
}
