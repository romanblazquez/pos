/**
 * EWP intent catalog — verbs an app asks the ERP bridge to fulfil.
 *
 * Intents are directed, higher-level than events. They are raised by apps
 * and resolved by the ERP bridge or a chooser if multiple handlers exist.
 */
import type { ErpSource } from './context.js';

export interface ErpIntentMap {
  /** Pull all products from the ERP and refresh the local catalog. */
  'ImportCatalog': { source: ErpSource; locationId?: string };
  /** Pull current stock levels for all (or specified) products. */
  'SyncInventory': { source: ErpSource; productIds?: string[]; locationId?: string };
  /** Pull customers/contacts from the ERP CRM. */
  'SyncCustomers': { source: ErpSource; limit?: number };
  /** Push a committed sale to the ERP as a sale order. */
  'ExportSale': {
    source: ErpSource;
    saleId: string;
    warehouseId?: number;
    lines: Array<{
      /** Retail OS product id, retained for traceability. */
      productId: string;
      /** Exact Odoo product.product variant id when the catalog came from Odoo. */
      erpProductId?: string;
      /** Exact-match fallbacks for retail-owned catalogs. */
      sku?: string;
      barcode?: string;
      qty: number;
      unitPriceMinorUnits: number;
      name: string;
    }>;
  };
  /** Open the ERP native UI for a given record. */
  'ViewErpRecord': { source: ErpSource; model: string; erpId: string };
  /** Trigger a full bidirectional sync for all entities. */
  'FullErpSync': { source: ErpSource };
}

export type ErpIntentName = keyof ErpIntentMap;
