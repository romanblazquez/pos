/**
 * Translators from Odoo raw model records to EWP context types.
 *
 * Each translator takes the raw Odoo `search_read` row and returns a
 * strongly-typed EWP context. Mapping is intentionally explicit so we
 * notice when Odoo model fields change (fail loudly, not silently).
 */
import type {
  ErpProductContext,
  ErpInventoryContext,
  ErpCustomerContext,
  ErpSaleOrderLine,
} from '@retail-os/erp-core';

type OdooRecord = Record<string, unknown>;

function str(v: unknown): string {
  if (Array.isArray(v)) return String(v[1] ?? '');
  return String(v ?? '');
}
function num(v: unknown): number {
  return typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0;
}
function bool(v: unknown): boolean {
  return v === true || v === 1;
}

// ─── product.product → ErpProductContext ────────────────────────────────────

export const ODOO_PRODUCT_FIELDS = [
  'id', 'name', 'display_name', 'default_code', 'barcode', 'categ_id',
  'list_price', 'taxes_id', 'active', 'type',
  'tracking',        // 'none' | 'lot' | 'serial'
  'product_tmpl_id', // [id, name] — groups variants under the same template
] as const;

export function odooProductToErp(row: OdooRecord, odooUrl: string): ErpProductContext {
  const erpId = String(row['id']);
  const displayName = str(row['display_name']);
  const baseName = str(row['name']);

  // Extract variant attributes from display_name: "Camiseta (Color: Rojo, Talla: L)" → "Color: Rojo, Talla: L"
  const parenMatch = /\((.+)\)$/.exec(displayName);
  const variantDescription = parenMatch ? parenMatch[1] : undefined;

  const templateId = Array.isArray(row['product_tmpl_id'])
    ? String(row['product_tmpl_id'][0])
    : undefined;

  return {
    type: 'erp.product',
    source: 'odoo',
    name: baseName,
    id: {
      erpId,
      sku: str(row['default_code']) || undefined,
      barcode: str(row['barcode']) || undefined,
    },
    sku: str(row['default_code']),
    barcode: str(row['barcode']) || undefined,
    category: Array.isArray(row['categ_id']) ? str(row['categ_id'][1]) : 'Sin categoría',
    // list_price is in the currency unit (e.g. MXN pesos) — convert to minor units (centavos)
    priceMinorUnits: Math.round(num(row['list_price']) * 100),
    currency: 'MXN',
    taxRatePercent: 16, // default IVA; TODO: resolve taxes_id → rate
    active: bool(row['active']),
    trackInventory: row['type'] === 'product',
    templateId,
    variantDescription,
    // Odoo serves product images at a stable URL; requires an active session to load
    imageUrl: `${odooUrl}/web/image/product.product/${erpId}/image_128`,
    erpUrl: `${odooUrl}/odoo/inventory/products/${erpId}`,
  };
}

// ─── stock.quant → ErpInventoryContext ──────────────────────────────────────

export const ODOO_QUANT_FIELDS = [
  'id', 'product_id', 'location_id', 'quantity', 'reserved_quantity',
] as const;

export function odooQuantToErp(row: OdooRecord): ErpInventoryContext {
  const productId = Array.isArray(row['product_id']) ? String(row['product_id'][0]) : '';
  const productName = Array.isArray(row['product_id']) ? str(row['product_id'][1]) : '';
  const locationName = Array.isArray(row['location_id']) ? str(row['location_id'][1]) : '';
  const onHand = num(row['quantity']);
  const reserved = num(row['reserved_quantity']);

  return {
    type: 'erp.inventory',
    source: 'odoo',
    id: {
      erpId: String(row['id']),
      productId,
      locationId: Array.isArray(row['location_id']) ? String(row['location_id'][0]) : undefined,
    },
    productErpId: productId,
    productName,
    locationName,
    onHand,
    reserved,
    available: onHand - reserved,
    uom: 'Units',
    lastUpdated: new Date().toISOString(),
  };
}

// ─── res.partner → ErpCustomerContext ────────────────────────────────────────

export const ODOO_PARTNER_FIELDS = [
  'id', 'name', 'email', 'phone', 'vat', 'property_product_pricelist',
  'credit_limit',
] as const;

export function odooPartnerToErp(row: OdooRecord): ErpCustomerContext {
  return {
    type: 'erp.customer',
    source: 'odoo',
    id: {
      erpId: String(row['id']),
      email: str(row['email']) || undefined,
      vatId: str(row['vat']) || undefined,
    },
    name: str(row['name']),
    email: str(row['email']) || undefined,
    phone: str(row['phone']) || undefined,
    vatId: str(row['vat']) || undefined,
    pricelist: Array.isArray(row['property_product_pricelist'])
      ? str(row['property_product_pricelist'][1])
      : undefined,
    creditLimit: num(row['credit_limit']) || undefined,
    currency: 'MXN',
  };
}

// ─── sale.order line payload → ErpSaleOrderLine ───────────────────────────────

export function saleLineFromPos(line: {
  name: string;
  productId: string;
  qty: number;
  unitPriceMinorUnits: number;
}): ErpSaleOrderLine {
  const unitPrice = line.unitPriceMinorUnits / 100;
  return {
    productErpId: line.productId,
    productName: line.name,
    quantity: line.qty,
    priceUnit: unitPrice,
    priceSubtotal: unitPrice * line.qty,
  };
}
