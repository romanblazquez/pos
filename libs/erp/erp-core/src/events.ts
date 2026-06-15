/**
 * EWP event catalog — ERP-sourced events published on the RWP bus.
 *
 * All EWP events are prefixed `erp.` and carry a `source` discriminator
 * so multi-ERP environments can filter by system without type guards.
 */
import type { ErpSource, ErpProductContext } from './context.js';

export interface ErpSyncResultPayload {
  source: ErpSource;
  entity: 'catalog' | 'inventory' | 'customers' | 'sale-orders';
  imported: number;
  failed: number;
  durationMs: number;
}

export interface ErpInventoryUpdatedPayload {
  source: ErpSource;
  items: Array<{
    productErpId: string;
    productName: string;
    sku?: string;
    variantDescription?: string;
    imageUrl?: string;
    locationName: string;
    trackInventory: boolean;
    onHand: number;
    available: number;
  }>;
  syncedAt: string;
}

export interface ErpCatalogSyncedPayload {
  source: ErpSource;
  products: ErpProductContext[];
  syncedAt: string;
}

export interface ErpSaleExportedPayload {
  source: ErpSource;
  saleId: string;
  erpOrderId: string;
  erpOrderName: string;
}

export interface ErpConnectionChangedPayload {
  source: ErpSource;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  url: string;
  database?: string;
  version?: string;
  error?: string;
}

export interface ErpEventMap {
  'erp.catalog.synced': ErpCatalogSyncedPayload;
  'erp.inventory.updated': ErpInventoryUpdatedPayload;
  'erp.sale.exported': ErpSaleExportedPayload;
  'erp.sync.completed': ErpSyncResultPayload;
  'erp.connection.changed': ErpConnectionChangedPayload;
}

export type ErpEventType = keyof ErpEventMap;
