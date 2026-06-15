/**
 * OdooBridge — the EWP ↔ Odoo adapter.
 *
 * Responsibilities:
 * 1. Maintain an authenticated OdooClient session.
 * 2. Expose imperative sync methods (syncCatalog, syncInventory, syncCustomers, exportSale).
 * 3. Emit typed EWP events on an event emitter so the Electron main process
 *    can forward them onto the RWP bus and expose them to renderer apps.
 *
 * This class has zero Electron / IPC dependencies so it can be unit-tested in
 * Node.js or used in a plain HTTP context (e.g. a REST sync worker).
 */
import { EventEmitter } from 'node:events';
import { OdooClient, type OdooConfig } from './odoo-client.js';
import {
  ODOO_PRODUCT_FIELDS,
  ODOO_QUANT_FIELDS,
  ODOO_PARTNER_FIELDS,
  odooProductToErp,
  odooQuantToErp,
  odooPartnerToErp,
} from './odoo-translators.js';
import type {
  ErpConnectionChangedPayload,
  ErpCatalogSyncedPayload,
  ErpInventoryUpdatedPayload,
  ErpSyncResultPayload,
  ErpSaleExportedPayload,
} from '@retail-os/erp-core';

export interface OdooBridgeConfig extends OdooConfig {
  /** How often to poll Odoo for inventory changes (ms). 0 = manual only. */
  pollIntervalMs?: number;
  /** Internal stock locations filter — default: all internal locations. */
  locationDomain?: unknown[][];
  /** Odoo stock.warehouse id. Required when the database has multiple warehouses. */
  warehouseId?: number;
}

export type OdooBridgeEventMap = {
  'connection:changed': [ErpConnectionChangedPayload];
  'catalog:synced': [ErpCatalogSyncedPayload];
  'inventory:updated': [ErpInventoryUpdatedPayload];
  'sale:exported': [ErpSaleExportedPayload];
  'sync:completed': [ErpSyncResultPayload];
  'error': [Error];
};

export class OdooBridge extends EventEmitter {
  private readonly client: OdooClient;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private _connected = false;

  constructor(private readonly config: OdooBridgeConfig) {
    super();
    this.client = new OdooClient(config);
  }

  get connected(): boolean {
    return this._connected;
  }

  /** The raw session_id cookie value after a successful connect(), or null. */
  get sessionId(): string | null {
    return this.client.currentSession?.sessionId ?? null;
  }

  /** Proxy an Odoo image URL through the authenticated session. Returns a data URI or null. */
  fetchImage(url: string): Promise<string | null> {
    return this.client.fetchImage(url);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.emit('connection:changed', {
      source: 'odoo',
      status: 'syncing',
      url: this.config.url,
    } satisfies ErpConnectionChangedPayload);

    try {
      const session = await this.client.authenticate();
      this._connected = true;
      this.emit('connection:changed', {
        source: 'odoo',
        status: 'connected',
        url: this.config.url,
        database: session.database,
        version: session.serverVersion,
      } satisfies ErpConnectionChangedPayload);

      if (this.config.pollIntervalMs && this.config.pollIntervalMs > 0) {
        this.startPolling(this.config.pollIntervalMs);
      }
    } catch (err) {
      this._connected = false;
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('connection:changed', {
        source: 'odoo',
        status: 'error',
        url: this.config.url,
        error: error.message,
      } satisfies ErpConnectionChangedPayload);
      throw error;
    }
  }

  disconnect(): void {
    this.stopPolling();
    this._connected = false;
    this.emit('connection:changed', {
      source: 'odoo',
      status: 'disconnected',
      url: this.config.url,
    } satisfies ErpConnectionChangedPayload);
  }

  // ─── Sync methods ─────────────────────────────────────────────────────────

  async syncCatalog(): Promise<ErpCatalogSyncedPayload> {
    const t0 = Date.now();
    const rows = await this.client.searchReadAll('product.product', {
      domain: [['active', '=', true]],
      fields: [...ODOO_PRODUCT_FIELDS],
      order: 'id asc',
    });

    const products = (rows as Record<string, unknown>[]).map((r) =>
      odooProductToErp(r, this.config.url),
    );

    const payload: ErpCatalogSyncedPayload = {
      source: 'odoo',
      products,
      syncedAt: new Date().toISOString(),
    };

    this.emit('catalog:synced', payload);
    this.emit('sync:completed', {
      source: 'odoo',
      entity: 'catalog',
      imported: products.length,
      failed: 0,
      durationMs: Date.now() - t0,
    } satisfies ErpSyncResultPayload);

    return payload;
  }

  async syncInventory(productIds?: string[]): Promise<ErpInventoryUpdatedPayload> {
    const t0 = Date.now();
    const numericProductIds = productIds
      ?.map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    const productDomain: unknown[][] = [['active', '=', true]];
    if (numericProductIds?.length) {
      productDomain.push(['id', 'in', numericProductIds]);
    }

    const productRows = await this.client.searchReadAll('product.product', {
      domain: productDomain,
      fields: [...ODOO_PRODUCT_FIELDS],
      order: 'id asc',
    });
    const products = (productRows as Record<string, unknown>[])
      .map((row) => odooProductToErp(row, this.config.url));
    const productsById = new Map(products.map((product) => [product.id.erpId, product]));

    const domain: unknown[][] = [
      ['location_id.usage', '=', 'internal'],
      ...(this.config.locationDomain ?? []),
    ];
    if (numericProductIds?.length) {
      domain.push(['product_id', 'in', numericProductIds]);
    }

    const rows = await this.client.searchReadAll('stock.quant', {
      domain,
      fields: [...ODOO_QUANT_FIELDS],
      order: 'product_id asc, location_id asc, id asc',
    });

    const seenProductIds = new Set<string>();
    const items = (rows as Record<string, unknown>[]).flatMap((row) => {
      const ctx = odooQuantToErp(row);
      const product = productsById.get(ctx.productErpId);
      if (!product) return [];

      seenProductIds.add(ctx.productErpId);
      return [{
        productErpId: ctx.productErpId,
        productName: product.name,
        sku: product.sku || undefined,
        variantDescription: product.variantDescription,
        imageUrl: product.imageUrl,
        locationName: ctx.locationName,
        trackInventory: product.trackInventory,
        onHand: ctx.onHand,
        available: ctx.available,
      }];
    });

    for (const product of products) {
      if (seenProductIds.has(product.id.erpId)) continue;
      items.push({
        productErpId: product.id.erpId,
        productName: product.name,
        sku: product.sku || undefined,
        variantDescription: product.variantDescription,
        imageUrl: product.imageUrl,
        locationName: product.trackInventory ? 'Sin existencias' : 'No controla inventario',
        trackInventory: product.trackInventory,
        onHand: 0,
        available: 0,
      });
    }

    const payload: ErpInventoryUpdatedPayload = {
      source: 'odoo',
      items,
      syncedAt: new Date().toISOString(),
    };

    this.emit('inventory:updated', payload);
    this.emit('sync:completed', {
      source: 'odoo',
      entity: 'inventory',
      imported: items.length,
      failed: 0,
      durationMs: Date.now() - t0,
    } satisfies ErpSyncResultPayload);

    return payload;
  }

  async syncCustomers(): Promise<number> {
    const rows = await this.client.searchReadAll('res.partner', {
      domain: [['customer_rank', '>', 0], ['active', '=', true]],
      fields: [...ODOO_PARTNER_FIELDS],
      order: 'id asc',
    });
    const customers = (rows as Record<string, unknown>[]).map(odooPartnerToErp);
    // Emit as individual context items — consumers store them locally
    for (const customer of customers) {
      this.emit('catalog:synced', customer);
    }
    return customers.length;
  }

  /**
   * Export a committed POS sale to Odoo as a sale.order.
   * Returns the Odoo order id and name.
   */
  async exportSale(
    saleId: string,
    lines: Array<{
      productId: string;
      erpProductId?: string;
      sku?: string;
      barcode?: string;
      qty: number;
      unitPriceMinorUnits: number;
      name: string;
    }>,
    requestedWarehouseId?: number,
  ): Promise<ErpSaleExportedPayload> {
    const resolvedLines = await Promise.all(lines.map((line) => this.resolveSaleLine(line)));
    const warehouseId = await this.resolveWarehouseId(requestedWarehouseId);
    const partnerId = await this.resolvePosPartnerId();
    const origin = `POS:${saleId}`;
    const existingOrders = await this.client.searchRead<Record<string, unknown>>('sale.order', {
      domain: [['origin', '=', origin]],
      fields: ['id', 'name', 'state', 'picking_ids'],
      order: 'id asc',
      limit: 2,
    });
    if (existingOrders.length > 1) {
      throw new Error(`Multiple Odoo sale orders already exist for ${origin}`);
    }

    const orderLines = resolvedLines.map(({ line, variantId }) => [
      0, 0,
      {
        product_id: variantId,
        name: line.name,
        product_uom_qty: line.qty,
        price_unit: line.unitPriceMinorUnits / 100,
      },
    ]);

    const erpId = existingOrders[0]
      ? Number(existingOrders[0]['id'])
      : await this.client.create('sale.order', {
          origin,
          partner_id: partnerId,
          warehouse_id: warehouseId,
          order_line: orderLines,
        });

    const currentState = String(existingOrders[0]?.['state'] ?? 'draft');
    if (currentState === 'cancel') {
      throw new Error(`Odoo sale order for ${origin} is cancelled`);
    }
    if (currentState === 'draft' || currentState === 'sent') {
      await this.client.callKw('sale.order', 'action_confirm', [[erpId]]);
    }

    const orders = await this.client.searchRead<Record<string, unknown>>('sale.order', {
      domain: [['id', '=', erpId]],
      fields: ['name', 'picking_ids'],
      limit: 1,
    });
    const pickingIds = Array.isArray(orders[0]?.['picking_ids'])
      ? (orders[0]['picking_ids'] as unknown[]).map(Number)
      : [];
    await this.validateOutgoingPickings(pickingIds);

    const erpOrderName = String((orders[0]?.['name']) ?? `S${erpId}`);

    const payload: ErpSaleExportedPayload = {
      source: 'odoo',
      saleId,
      erpOrderId: String(erpId),
      erpOrderName,
    };

    this.emit('sale:exported', payload);
    await this.syncInventory(resolvedLines.map(({ variantId }) => String(variantId)));
    return payload;
  }

  private async resolveSaleLine(line: {
    productId: string;
    erpProductId?: string;
    sku?: string;
    barcode?: string;
    qty: number;
    unitPriceMinorUnits: number;
    name: string;
  }): Promise<{ line: typeof line; variantId: number }> {
    const fields = ['id', 'name', 'default_code', 'barcode', 'active'];
    let matches: Record<string, unknown>[] = [];

    if (line.erpProductId) {
      const variantId = Number(line.erpProductId);
      if (!Number.isInteger(variantId) || variantId <= 0) {
        throw new Error(`Invalid Odoo variant id "${line.erpProductId}" for ${line.name}`);
      }
      matches = await this.client.searchRead('product.product', {
        domain: [['id', '=', variantId], ['active', '=', true]],
        fields,
        limit: 2,
      });
    } else if (line.barcode) {
      matches = await this.client.searchRead('product.product', {
        domain: [['barcode', '=', line.barcode], ['active', '=', true]],
        fields,
        limit: 2,
      });
    }

    if (matches.length === 0 && line.sku) {
      matches = await this.client.searchRead('product.product', {
        domain: [['default_code', '=', line.sku], ['active', '=', true]],
        fields,
        limit: 2,
      });
    }

    if (matches.length === 0) {
      throw new Error(
        `No active Odoo variant matches "${line.name}" (id=${line.erpProductId ?? 'n/a'}, sku=${line.sku ?? 'n/a'}, barcode=${line.barcode ?? 'n/a'})`,
      );
    }
    if (matches.length > 1) {
      throw new Error(`Odoo variant mapping is ambiguous for "${line.name}"`);
    }

    return { line, variantId: Number(matches[0]['id']) };
  }

  private async resolveWarehouseId(requestedWarehouseId?: number): Promise<number> {
    const warehouseId = requestedWarehouseId ?? this.config.warehouseId;
    if (warehouseId) {
      const matches = await this.client.searchRead('stock.warehouse', {
        domain: [['id', '=', warehouseId]],
        fields: ['id', 'name', 'code'],
        limit: 1,
      });
      if (matches.length === 0) throw new Error(`Odoo warehouse ${warehouseId} does not exist`);
      return warehouseId;
    }

    const warehouses = await this.client.searchRead('stock.warehouse', {
      fields: ['id', 'name', 'code'],
      order: 'id asc',
      limit: 2,
    });
    if (warehouses.length === 0) throw new Error('Odoo has no configured warehouse');
    if (warehouses.length > 1) {
      throw new Error('Odoo has multiple warehouses; configure a warehouse id for the POS');
    }
    return Number(warehouses[0]['id']);
  }

  private async resolvePosPartnerId(): Promise<number> {
    const partners = await this.client.searchRead('res.partner', {
      domain: [['ref', '=', 'retail-os-pos']],
      fields: ['id'],
      limit: 1,
    });
    if (partners[0]) return Number(partners[0]['id']);
    return this.client.create('res.partner', {
      name: 'Retail OS POS Customer',
      ref: 'retail-os-pos',
      customer_rank: 1,
    });
  }

  private async validateOutgoingPickings(pickingIds: number[]): Promise<void> {
    if (pickingIds.length === 0) return;
    const pickings = await this.client.searchRead<Record<string, unknown>>('stock.picking', {
      domain: [['id', 'in', pickingIds]],
      fields: ['id', 'name', 'state', 'picking_type_code'],
      order: 'id asc',
      limit: pickingIds.length,
    });

    for (const picking of pickings) {
      const pickingId = Number(picking['id']);
      const state = String(picking['state']);
      if (picking['picking_type_code'] !== 'outgoing' || state === 'done' || state === 'cancel') continue;

      await this.client.callKw('stock.picking', 'action_assign', [[pickingId]]);
      const moves = await this.client.searchRead<Record<string, unknown>>('stock.move', {
        domain: [['picking_id', '=', pickingId], ['state', 'not in', ['done', 'cancel']]],
        fields: ['id', 'product_uom_qty'],
        order: 'id asc',
        limit: 10_000,
      });
      for (const move of moves) {
        await this.client.write('stock.move', [Number(move['id'])], {
          quantity: Number(move['product_uom_qty']),
          picked: true,
        });
      }
      await this.client.callKw('stock.picking', 'button_validate', [[pickingId]], {
        context: { skip_backorder: true },
      });

      const refreshed = await this.client.searchRead<Record<string, unknown>>('stock.picking', {
        domain: [['id', '=', pickingId]],
        fields: ['name', 'state'],
        limit: 1,
      });
      if (refreshed[0]?.['state'] !== 'done') {
        throw new Error(`Odoo delivery ${String(refreshed[0]?.['name'] ?? pickingId)} was not validated`);
      }
    }
  }

  // ─── Polling ──────────────────────────────────────────────────────────────

  private startPolling(intervalMs: number): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.syncInventory().catch((err) => this.emit('error', err instanceof Error ? err : new Error(String(err))));
    }, intervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
