import type {
  ErpAdapter,
  ErpAdapterCapabilities,
  ErpIntentMap,
  ErpIntentName,
  ErpIntentResultMap,
  ErpPlatformEvent,
  ErpSyncResultPayload,
} from '@retail-os/erp-core';
import { OdooBridge, type OdooBridgeConfig } from './odoo-bridge.js';

const CAPABILITIES: ErpAdapterCapabilities = {
  intents: [
    'ImportCatalog',
    'SyncInventory',
    'SyncCustomers',
    'ExportSale',
    'ViewErpRecord',
    'FullErpSync',
  ],
  contextTypes: [
    'erp.product',
    'erp.inventory',
    'erp.customer',
    'erp.sale-order',
    'erp.connection',
  ],
};

/**
 * Odoo implementation of the vendor-neutral EWP adapter contract.
 *
 * The platform only sees ErpAdapter. Odoo JSON-RPC and model names stay
 * contained in this package.
 */
export class OdooErpAdapter implements ErpAdapter {
  readonly source = 'odoo' as const;
  readonly capabilities = CAPABILITIES;

  private readonly bridge: OdooBridge;
  private readonly listeners = new Set<(event: ErpPlatformEvent) => void>();

  constructor(private readonly config: OdooBridgeConfig) {
    this.bridge = new OdooBridge(config);
    this.bridge.on('connection:changed', (payload) => {
      this.emit({ type: 'erp.connection.changed', payload });
    });
    this.bridge.on('catalog:synced', (payload) => {
      this.emit({ type: 'erp.catalog.synced', payload });
    });
    this.bridge.on('inventory:updated', (payload) => {
      this.emit({ type: 'erp.inventory.updated', payload });
    });
    this.bridge.on('sale:exported', (payload) => {
      this.emit({ type: 'erp.sale.exported', payload });
    });
    this.bridge.on('sync:completed', (payload) => {
      this.emit({ type: 'erp.sync.completed', payload });
    });
    this.bridge.on('error', (error) => {
      this.emit({
        type: 'erp.connection.changed',
        payload: {
          source: 'odoo',
          status: 'error',
          url: this.config.url,
          error: error.message,
        },
      });
    });
  }

  get connected(): boolean {
    return this.bridge.connected;
  }

  get sessionId(): string | null {
    return this.bridge.sessionId;
  }

  fetchImage(url: string): Promise<string | null> {
    return this.bridge.fetchImage(url);
  }

  connect(): Promise<void> {
    return this.bridge.connect();
  }

  disconnect(): void {
    this.bridge.disconnect();
  }

  subscribe(listener: (event: ErpPlatformEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async invoke<K extends ErpIntentName>(
    intent: K,
    payload: ErpIntentMap[K],
  ): Promise<ErpIntentResultMap[K]> {
    switch (intent) {
      case 'ImportCatalog':
        return await this.bridge.syncCatalog() as ErpIntentResultMap[K];
      case 'SyncInventory': {
        const request = payload as ErpIntentMap['SyncInventory'];
        return await this.bridge.syncInventory(request.productIds) as ErpIntentResultMap[K];
      }
      case 'SyncCustomers': {
        const startedAt = Date.now();
        const imported = await this.bridge.syncCustomers();
        return {
          source: 'odoo',
          entity: 'customers',
          imported,
          failed: 0,
          durationMs: Date.now() - startedAt,
        } as ErpIntentResultMap[K];
      }
      case 'ExportSale': {
        const request = payload as ErpIntentMap['ExportSale'];
        return await this.bridge.exportSale(
          request.saleId,
          request.lines,
          request.warehouseId,
        ) as ErpIntentResultMap[K];
      }
      case 'ViewErpRecord': {
        const request = payload as ErpIntentMap['ViewErpRecord'];
        const path = this.recordPath(request.model, request.erpId);
        return {
          source: 'odoo',
          url: `${this.config.url}${path}`,
        } as ErpIntentResultMap[K];
      }
      case 'FullErpSync': {
        const startedAt = Date.now();
        const catalog = await this.bridge.syncCatalog();
        const inventory = await this.bridge.syncInventory();
        const results: ErpSyncResultPayload[] = [
          {
            source: 'odoo',
            entity: 'catalog',
            imported: catalog.products.length,
            failed: 0,
            durationMs: Date.now() - startedAt,
          },
          {
            source: 'odoo',
            entity: 'inventory',
            imported: inventory.items.length,
            failed: 0,
            durationMs: Date.now() - startedAt,
          },
        ];
        return { source: 'odoo', results } as ErpIntentResultMap[K];
      }
    }
  }

  private emit(event: ErpPlatformEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private recordPath(model: string, erpId: string): string {
    const encodedModel = encodeURIComponent(model);
    const encodedId = encodeURIComponent(erpId);
    return `/web#id=${encodedId}&model=${encodedModel}&view_type=form`;
  }
}
