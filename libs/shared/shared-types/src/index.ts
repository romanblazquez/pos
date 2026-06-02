/**
 * Cross-cutting types shared by apps and infrastructure that don't belong to a
 * single bounded context (device/store configuration, the sync ingestion DTO).
 */

export interface StoreConfig {
  tenantId: string;
  storeId: string;
  deviceId: string;
  currency: string;
  /** Default tax rate applied to products that don't override it (e.g. 16 = IVA). */
  defaultTaxRatePercent: number;
  locale: string;
}

/** Envelope the local sync-engine POSTs to the central API's ingestion endpoint. */
export interface SaleIngestionRequest {
  idempotencyKey: string;
  sale: unknown; // SaleSnapshot from @retail-os/sales, serialized
  outboxId: string;
  deviceId: string;
  occurredAt: string;
}

export interface SaleIngestionResponse {
  accepted: boolean;
  saleId: string;
  serverReceivedAt: string;
}
