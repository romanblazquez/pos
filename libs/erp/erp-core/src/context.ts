/**
 * ERP Workspace Protocol (EWP) — context types.
 *
 * EWP is the ERP-to-workspace interoperability layer for Retail OS.
 * Inspired by FDC3 2.0's typed context model, adapted to ERP domains:
 * products, inventory, customers, purchase orders, and accounting moves.
 *
 * Every context has a namespaced `type` string (e.g. "erp.product") so
 * adapters can route without inspecting the payload.
 */

export interface ErpContext {
  type: string;
  name?: string;
  id?: Record<string, string | undefined>;
  /** ERP source system: "odoo", "sap", "quickbooks", etc. */
  source: ErpSource;
  [key: string]: unknown;
}

export type ErpSource = 'odoo' | 'tiendanube' | 'quickbooks' | 'sap' | 'manual';

// ─── Product ─────────────────────────────────────────────────────────────────

export interface ErpProductContext extends ErpContext {
  type: 'erp.product';
  source: ErpSource;
  id: { erpId: string; sku?: string; barcode?: string };
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  /** Price in minor units (cents/centavos). */
  priceMinorUnits: number;
  currency: string;
  taxRatePercent: number;
  active: boolean;
  trackInventory: boolean;
  /** ERP template id grouping product variants together. */
  templateId?: string;
  /** Human-readable variant attributes, e.g. "Azul / L". */
  variantDescription?: string;
  /** Product image URL (Odoo HTTP endpoint or data-uri). */
  imageUrl?: string;
  /** ERP-native URL to the product record, if available. */
  erpUrl?: string;
}

// ─── Inventory / Stock ────────────────────────────────────────────────────────

export interface ErpInventoryContext extends ErpContext {
  type: 'erp.inventory';
  source: ErpSource;
  id: { erpId: string; productId?: string; locationId?: string };
  productErpId: string;
  productName: string;
  sku?: string;
  locationName: string;
  onHand: number;
  reserved: number;
  available: number;
  uom: string;
  lastUpdated: string;
}

// ─── Customer / Contact ───────────────────────────────────────────────────────

export interface ErpCustomerContext extends ErpContext {
  type: 'erp.customer';
  source: ErpSource;
  id: { erpId: string; email?: string; vatId?: string };
  name: string;
  email?: string;
  phone?: string;
  vatId?: string;
  pricelist?: string;
  creditLimit?: number;
  currency?: string;
}

// ─── Sale Order ───────────────────────────────────────────────────────────────

export interface ErpSaleOrderContext extends ErpContext {
  type: 'erp.sale-order';
  source: ErpSource;
  id: { erpId: string; name?: string; posReference?: string };
  name: string;
  state: 'draft' | 'sent' | 'sale' | 'done' | 'cancel';
  customerId?: string;
  dateOrder: string;
  amountTotal: number;
  currency: string;
  lines: ErpSaleOrderLine[];
}

export interface ErpSaleOrderLine {
  productErpId: string;
  productName: string;
  quantity: number;
  priceUnit: number;
  priceSubtotal: number;
}

// ─── Purchase Order ───────────────────────────────────────────────────────────

export interface ErpPurchaseOrderContext extends ErpContext {
  type: 'erp.purchase-order';
  source: ErpSource;
  id: { erpId: string; name?: string };
  name: string;
  state: 'draft' | 'sent' | 'purchase' | 'done' | 'cancel';
  supplierId: string;
  supplierName: string;
  dateOrder: string;
  amountTotal: number;
  currency: string;
}

// ─── Connection Status ────────────────────────────────────────────────────────

export interface ErpConnectionContext extends ErpContext {
  type: 'erp.connection';
  source: ErpSource;
  id: { url: string };
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  url: string;
  version?: string;
  database?: string;
  lastSyncAt?: string;
  error?: string;
}

export type AnyErpContext =
  | ErpProductContext
  | ErpInventoryContext
  | ErpCustomerContext
  | ErpSaleOrderContext
  | ErpPurchaseOrderContext
  | ErpConnectionContext;
