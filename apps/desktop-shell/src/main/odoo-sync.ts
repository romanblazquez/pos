/**
 * OdooSync — shell service that hosts the vendor-neutral ERP platform and
 * registers Odoo as one adapter.
 *
 * Odoo catalog rows are persisted into the same local SQLite repository used
 * by the POS. ERP events are also published over RWP so every hosted app can
 * react without importing Odoo-specific code.
 */
import { app, session, webContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { ProductSnapshot } from '@retail-os/catalog';
import type { SaleSnapshot } from '@retail-os/sales';
import type { Db, ProductRepository } from '@retail-os/local-db';
import type {
  ErpCatalogSyncedPayload,
  ErpConnectionChangedPayload,
  ErpIntentMap,
  ErpIntentName,
  ErpIntentResolution,
  ErpInventoryUpdatedPayload,
  ErpPlatformEvent,
  ErpSource,
} from '@retail-os/erp-core';
import { ErpPlatform } from '@retail-os/erp-platform';
import { OdooErpAdapter } from '@retail-os/odoo-bridge';
import type { RwpEnvelope } from '@retail-os/rwp-core';
import type { RwpBroker } from '@retail-os/rwp-electron-adapter';

export type CatalogSource = 'odoo' | 'retail';

export interface OdooConnectionConfig {
  url: string;
  database: string;
  username: string;
  password: string;
  pollIntervalMs: number;
  /** Odoo stock.warehouse id. Optional when Odoo has exactly one warehouse. */
  warehouseId?: number;
  /**
   * odoo: Odoo is authoritative and replaces the local Odoo product cache.
   * retail: Retail OS keeps its existing catalog; Odoo provides inventory only.
   */
  catalogSource: CatalogSource;
}

export interface OdooSyncState {
  status: 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';
  url: string | null;
  database: string | null;
  version: string | null;
  catalogSource: CatalogSource;
  catalogProductCount: number;
  pendingSaleExports: number;
  failedSaleExports: number;
  lastSyncAt: string | null;
  error: string | null;
}

const CONFIG_FILE = 'odoo-config.json';
const DEFAULT_STATE: OdooSyncState = {
  status: 'disconnected',
  url: null,
  database: null,
  version: null,
  catalogSource: 'odoo',
  catalogProductCount: 0,
  pendingSaleExports: 0,
  failedSaleExports: 0,
  lastSyncAt: null,
  error: null,
};

const ODOO_PARTITION = 'persist:retail-odoo';

/**
 * Called once at app startup. Removes the restrictive CSP that Odoo 19 sends
 * in its HTTP headers — Odoo's Owl template engine requires `unsafe-eval` to
 * compile templates, but its own CSP header blocks it inside Electron webviews.
 */
export function setupOdooWebviewSession(): void {
  const odooSession = session.fromPartition(ODOO_PARTITION);
  odooSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    // Strip Odoo's CSP — Owl needs unsafe-eval and fonts.googleapis.com for styles.
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });
}

/**
 * Injects the authenticated Odoo session cookie into the shared webview
 * partition so ERP module tabs (odoo-inventory, odoo-sales, etc.) open
 * already logged in — no second login required.
 */
async function injectOdooSessionCookie(odooUrl: string, sessionId: string): Promise<void> {
  try {
    const url = new URL(odooUrl);
    const odooSession = session.fromPartition(ODOO_PARTITION);
    await odooSession.cookies.set({
      url: `${url.protocol}//${url.host}`,
      name: 'session_id',
      value: sessionId,
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });
  } catch (err) {
    console.warn('[odoo-sync] Could not inject session cookie:', err);
  }
}

export class OdooSync {
  private readonly platform = new ErpPlatform();
  private adapter: OdooErpAdapter | null = null;
  private unregisterAdapter: (() => void) | null = null;
  private state: OdooSyncState = { ...DEFAULT_STATE };
  private config: OdooConnectionConfig | null = null;
  private processingSaleExports = false;

  constructor(
    private readonly products: ProductRepository,
    private readonly db: Db,
    private readonly broker: RwpBroker,
  ) {
    this.platform.subscribe((event) => this.handlePlatformEvent(event));
    this.refreshSaleExportCounts();
    const timer = setInterval(() => void this.processPendingSaleExports(), 5_000);
    timer.unref();
  }

  getState(): OdooSyncState {
    return { ...this.state };
  }

  listSources(): ErpSource[] {
    return this.platform.listSources();
  }

  findIntent(intent: ErpIntentName, source?: ErpSource) {
    return this.platform.findIntent(intent, source);
  }

  raiseIntent<K extends ErpIntentName>(
    intent: K,
    payload: ErpIntentMap[K],
  ): Promise<ErpIntentResolution<K>> {
    return this.platform.raiseIntent(intent, payload);
  }

  loadConfig(): OdooConnectionConfig | null {
    const path = join(app.getPath('userData'), CONFIG_FILE);
    if (!existsSync(path)) return null;
    try {
      const saved = JSON.parse(readFileSync(path, 'utf-8')) as Partial<OdooConnectionConfig>;
      if (!saved.url || !saved.database || !saved.username || !saved.password) return null;
      return {
        url: saved.url,
        database: saved.database,
        username: saved.username,
        password: saved.password,
        pollIntervalMs: saved.pollIntervalMs ?? 60_000,
        warehouseId: saved.warehouseId,
        catalogSource: saved.catalogSource ?? 'odoo',
      };
    } catch {
      return null;
    }
  }

  async connectSaved(): Promise<OdooSyncState> {
    const saved = this.loadConfig();
    return saved ? this.connect(saved) : this.getState();
  }

  saveConfig(config: OdooConnectionConfig): void {
    const path = join(app.getPath('userData'), CONFIG_FILE);
    writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
  }

  clearConfig(): void {
    const path = join(app.getPath('userData'), CONFIG_FILE);
    if (existsSync(path)) unlinkSync(path);
  }

  async connect(input: OdooConnectionConfig): Promise<OdooSyncState> {
    this.unregisterAdapter?.();
    this.unregisterAdapter = null;

    const config: OdooConnectionConfig = {
      ...input,
      pollIntervalMs: input.pollIntervalMs ?? 60_000,
      catalogSource: input.catalogSource ?? 'odoo',
    };
    this.config = config;
    this.state = {
      ...DEFAULT_STATE,
      status: 'connecting',
      url: config.url,
      database: config.database,
      catalogSource: config.catalogSource,
      catalogProductCount: this.countOdooProducts(),
      pendingSaleExports: this.state.pendingSaleExports,
      failedSaleExports: this.state.failedSaleExports,
    };
    this.broadcast('odoo:stateChanged', this.state);

    this.adapter = new OdooErpAdapter({
      url: config.url,
      database: config.database,
      username: config.username,
      password: config.password,
      pollIntervalMs: config.pollIntervalMs,
      locationDomain: [],
      warehouseId: config.warehouseId,
    });
    this.unregisterAdapter = this.platform.registerAdapter(this.adapter);

    try {
      await this.platform.connect('odoo');
      this.saveConfig(config);
      // Inject the session cookie so webview tabs open already authenticated.
      const sessionId = this.adapter?.sessionId;
      if (sessionId) void injectOdooSessionCookie(config.url, sessionId);
      void this.processPendingSaleExports();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state = { ...this.state, status: 'error', error: message };
      this.broadcast('odoo:stateChanged', this.state);
    }

    return this.getState();
  }

  /** Proxy an Odoo image URL through the authenticated session → data URI. */
  fetchImage(url: string): Promise<string | null> {
    return this.adapter?.fetchImage(url) ?? Promise.resolve(null);
  }

  disconnect(): OdooSyncState {
    this.platform.disconnect('odoo');
    this.unregisterAdapter?.();
    this.unregisterAdapter = null;
    this.adapter = null;
    this.config = null;
    this.clearConfig();
    this.state = {
      ...DEFAULT_STATE,
      catalogProductCount: this.countOdooProducts(),
    };
    this.refreshSaleExportCounts();
    this.broadcast('odoo:stateChanged', this.state);
    return this.getState();
  }

  async syncCatalog(): Promise<OdooSyncState> {
    this.ensureConnected();
    this.setSyncing();
    try {
      await this.platform.raiseIntent('ImportCatalog', { source: 'odoo' });
      this.setConnected();
    } catch (err) {
      this.setError(err);
      throw err;
    }
    return this.getState();
  }

  async syncInventory(): Promise<OdooSyncState> {
    this.ensureConnected();
    this.setSyncing();
    try {
      await this.platform.raiseIntent('SyncInventory', { source: 'odoo' });
      this.setConnected();
    } catch (err) {
      this.setError(err);
      throw err;
    }
    return this.getState();
  }

  async processPendingSaleExports(): Promise<void> {
    if (this.processingSaleExports) return;
    if (this.platform.findIntent('ExportSale', 'odoo').every((handler) => !handler.connected)) {
      this.refreshSaleExportCounts();
      return;
    }

    this.processingSaleExports = true;
    try {
      const due = this.db.prepare(
        `SELECT sale_id, payload, attempts
           FROM erp_sale_exports
          WHERE source = 'odoo'
            AND status IN ('pending', 'failed')
            AND next_attempt_at <= ?
          ORDER BY created_at ASC
          LIMIT 20`,
      ).all(new Date().toISOString()) as Array<{
        sale_id: string;
        payload: string;
        attempts: number;
      }>;

      for (const row of due) {
        try {
          const sale = JSON.parse(row.payload) as SaleSnapshot;
          const lines = sale.lines.map((line) => {
            const product = this.products.findById(String(line.productId));
            const odooId = /^odoo-(\d+)$/.exec(String(line.productId))?.[1];
            return {
              productId: String(line.productId),
              erpProductId: odooId,
              sku: product?.sku,
              barcode: product?.barcode,
              qty: line.quantity,
              unitPriceMinorUnits: line.unitPrice.minorUnits,
              name: line.name,
            };
          });
          const resolution = await this.platform.raiseIntent('ExportSale', {
            source: 'odoo',
            saleId: sale.saleId,
            warehouseId: this.config?.warehouseId,
            lines,
          });
          const now = new Date().toISOString();
          this.db.prepare(
            `UPDATE erp_sale_exports
                SET status = 'synced',
                    erp_order_id = ?,
                    last_error = NULL,
                    updated_at = ?
              WHERE sale_id = ?`,
          ).run(resolution.result.erpOrderId, now, sale.saleId);
        } catch (error) {
          const attempts = row.attempts + 1;
          const delayMs = Math.min(1_000 * 2 ** Math.min(attempts, 8), 300_000);
          const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
          this.db.prepare(
            `UPDATE erp_sale_exports
                SET status = 'failed',
                    attempts = ?,
                    next_attempt_at = ?,
                    last_error = ?,
                    updated_at = ?
              WHERE sale_id = ?`,
          ).run(
            attempts,
            nextAttemptAt,
            error instanceof Error ? error.message : String(error),
            new Date().toISOString(),
            row.sale_id,
          );
        }
      }
    } finally {
      this.processingSaleExports = false;
      this.refreshSaleExportCounts();
    }
  }

  private handlePlatformEvent(event: ErpPlatformEvent): void {
    if (event.type === 'erp.connection.changed') {
      this.updateConnectionState(event.payload);
    } else if (event.type === 'erp.catalog.synced') {
      this.handleCatalogSynced(event.payload);
    } else if (event.type === 'erp.inventory.updated') {
      this.handleInventoryUpdated(event.payload);
    }

    this.broadcast('erp:event', event);
    this.publishRwp(event);
  }

  private updateConnectionState(payload: ErpConnectionChangedPayload): void {
    this.state = {
      ...this.state,
      status: payload.status,
      url: payload.url,
      database: payload.database ?? this.state.database,
      version: payload.version ?? this.state.version,
      error: payload.error ?? null,
    };
    this.broadcast('odoo:stateChanged', this.state);
  }

  private handleCatalogSynced(payload: ErpCatalogSyncedPayload): void {
    if ((this.config?.catalogSource ?? this.state.catalogSource) === 'odoo') {
      this.persistCatalog(payload);
    }
    this.state = {
      ...this.state,
      catalogProductCount: this.countOdooProducts(),
      lastSyncAt: payload.syncedAt,
    };
    this.broadcast('odoo:catalogSynced', payload);
    this.broadcast('odoo:stateChanged', this.state);
  }

  private handleInventoryUpdated(payload: ErpInventoryUpdatedPayload): void {
    this.state = { ...this.state, lastSyncAt: payload.syncedAt };
    this.broadcast('odoo:inventoryUpdated', payload);
    this.broadcast('odoo:stateChanged', this.state);
  }

  private persistCatalog(payload: ErpCatalogSyncedPayload): void {
    const snapshots: ProductSnapshot[] = payload.products.map((product) => ({
      id: `odoo-${product.id.erpId}`,
      sku: product.sku || `ODOO-${product.id.erpId}`,
      name: product.name,
      barcode: product.barcode,
      category: product.category ?? 'Sin categoria',
      priceMinorUnits: product.priceMinorUnits,
      currency: product.currency,
      taxRatePercent: product.taxRatePercent,
      trackInventory: product.trackInventory,
      active: product.active,
      templateId: product.templateId ? `odoo-tmpl-${product.templateId}` : undefined,
      variantDescription: product.variantDescription,
      imageUrl: product.imageUrl,
    }));
    const replaceOdooCatalog = this.db.transaction((rows: ProductSnapshot[]) => {
      this.db.exec("DELETE FROM products WHERE id LIKE 'odoo-%'");
      if (rows.length > 0) this.products.upsertMany(rows);
    });
    replaceOdooCatalog(snapshots);
  }

  private publishRwp(event: ErpPlatformEvent): void {
    const envelope: RwpEnvelope = {
      eventId: randomUUID(),
      correlationId: randomUUID(),
      timestamp: new Date().toISOString(),
      source: 'platform:erp',
      target: null,
      version: '1.0',
      kind: 'event',
      type: event.type,
      payload: event.payload,
    };
    this.broker.publish(envelope, -1);
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(channel, payload);
    }
  }

  private ensureConnected(): void {
    if (this.platform.findIntent('ImportCatalog', 'odoo').every((handler) => !handler.connected)) {
      throw new Error('Not connected to Odoo');
    }
  }

  private setSyncing(): void {
    this.state = { ...this.state, status: 'syncing', error: null };
    this.broadcast('odoo:stateChanged', this.state);
  }

  private setConnected(): void {
    this.state = {
      ...this.state,
      status: 'connected',
      lastSyncAt: new Date().toISOString(),
      error: null,
    };
    this.broadcast('odoo:stateChanged', this.state);
  }

  private setError(error: unknown): void {
    this.state = {
      ...this.state,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    this.broadcast('odoo:stateChanged', this.state);
  }

  private countOdooProducts(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM products WHERE id LIKE 'odoo-%'")
      .get() as { count: number };
    return row.count;
  }

  private refreshSaleExportCounts(): void {
    const row = this.db.prepare(
      `SELECT
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM erp_sale_exports
       WHERE source = 'odoo'`,
    ).get() as { pending: number | null; failed: number | null };
    this.state = {
      ...this.state,
      pendingSaleExports: row.pending ?? 0,
      failedSaleExports: row.failed ?? 0,
    };
    this.broadcast('odoo:stateChanged', this.state);
  }
}
