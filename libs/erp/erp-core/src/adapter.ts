import type { ErpSource } from './context.js';
import type {
  ErpCatalogSyncedPayload,
  ErpEventMap,
  ErpInventoryUpdatedPayload,
  ErpSaleExportedPayload,
  ErpSyncResultPayload,
} from './events.js';
import type { ErpIntentMap, ErpIntentName } from './intents.js';

export interface ErpIntentResultMap {
  ImportCatalog: ErpCatalogSyncedPayload;
  SyncInventory: ErpInventoryUpdatedPayload;
  SyncCustomers: ErpSyncResultPayload;
  ExportSale: ErpSaleExportedPayload;
  ViewErpRecord: { source: ErpSource; url: string };
  FullErpSync: {
    source: ErpSource;
    results: ErpSyncResultPayload[];
  };
}

export type ErpPlatformEvent = {
  [K in keyof ErpEventMap]: {
    type: K;
    payload: ErpEventMap[K];
  };
}[keyof ErpEventMap];

export interface ErpAdapterCapabilities {
  intents: ErpIntentName[];
  contextTypes: string[];
}

/**
 * Vendor-neutral ERP adapter contract.
 *
 * Applications raise EWP intents through the platform and never import an
 * Odoo/SAP/etc. client directly. This is the ERP equivalent of the FDC3
 * InteropAdapter boundary.
 */
export interface ErpAdapter {
  readonly source: ErpSource;
  readonly capabilities: ErpAdapterCapabilities;
  readonly connected: boolean;

  connect(): Promise<void>;
  disconnect(): void;
  subscribe(listener: (event: ErpPlatformEvent) => void): () => void;
  invoke<K extends ErpIntentName>(
    intent: K,
    payload: ErpIntentMap[K],
  ): Promise<ErpIntentResultMap[K]>;
}

export interface ErpIntentHandlerInfo {
  source: ErpSource;
  intent: ErpIntentName;
  connected: boolean;
}

export interface ErpIntentResolution<K extends ErpIntentName = ErpIntentName> {
  source: ErpSource;
  intent: K;
  result: ErpIntentResultMap[K];
}

export class ErpIntentResolutionError extends Error {
  constructor(
    public readonly intent: ErpIntentName,
    public readonly source: ErpSource,
    message = `No ERP adapter handles "${intent}" for source "${source}"`,
  ) {
    super(message);
    this.name = 'ErpIntentResolutionError';
  }
}
