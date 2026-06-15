import { createServer } from 'node:http';
import { shell, webContents } from 'electron';
import { ProductRepository, type Db } from '@retail-os/local-db';
import type { ProductSnapshot } from '@retail-os/catalog';

// ── Tiendanube API types ─────────────────────────────────────────────────────

interface TiendanubeTokenResponse {
  access_token: string;
  token_type: string;
  user_id?: number | string;
  store_id?: number | string;
  scope: string;
}

interface TiendanubeProduct {
  id: number;
  name: Record<string, string>;
  published: boolean;
  categories: Array<{ id: number }>;
  variants: TiendanubeVariant[];
  images: Array<{ src: string }>;
}


interface TiendanubeVariant {
  id: number;
  sku: string | null;
  barcode: string | null;
  price: string;
  stock_management: boolean;
  stock: number | null;
  inventory_levels: Array<{ location_id: string; stock: number }> | null;
  values: Array<{ en?: string; es?: string }>;
  image_id?: number | null;
}

interface TiendanubeLocation {
  id: string;
  name: Record<string, string>;
  is_default: boolean;
}

interface TiendanubeCategory {
  id: number;
  name: Record<string, string>;
}

// ── Sync state ───────────────────────────────────────────────────────────────

export interface TiendanubeSyncState {
  status: 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';
  storeId: string | null;
  lastSyncAt: string | null;
  productCount: number;
  error: string | null;
  callbackUrl: string;
}

const TIENDANUBE_AUTH_BASE = 'https://www.tiendanube.com';
const TIENDANUBE_API_BASE = 'https://api.tiendanube.com/2025-03';
const USER_AGENT = 'RetailOS (pos@retailos.dev)';
const OAUTH_PORT = Number(process.env['TIENDANUBE_OAUTH_PORT'] ?? 43821);
const OAUTH_PATH = '/tiendanube/callback';
const OAUTH_CALLBACK_URL =
  process.env['TIENDANUBE_REDIRECT_URI'] ?? `http://localhost:${OAUTH_PORT}${OAUTH_PATH}`;
const POLL_INTERVAL_MS = 60_000; // 60 s delta poll

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * TiendanubeSync — manages the OAuth connection to a Tiendanube store and
 * imports their product catalog into the local SQLite database.
 *
 * Runs entirely in the Electron main process. The renderer communicates via
 * IPC handles exposed through the preload bridge.
 */
export class TiendanubeSync {
  private state: TiendanubeSyncState = {
    status: 'disconnected',
    storeId: null,
    lastSyncAt: null,
    productCount: 0,
    error: null,
    callbackUrl: OAUTH_CALLBACK_URL,
  };

  private accessToken: string | null = null;
  private abortOAuth: (() => void) | null = null;
  private oauthAttempt = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastDeltaAt: string | null = null;

  constructor(
    private readonly products: ProductRepository,
    private readonly db: Db,
  ) {
    this.loadExistingConnection();
  }

  getState(): TiendanubeSyncState {
    return { ...this.state };
  }

  /** Start the OAuth flow: open browser → catch callback → exchange code. */
  async connect(appId: string, clientSecret: string): Promise<TiendanubeSyncState> {
    if (this.state.status === 'connecting') return this.getState();
    if (!/^\d+$/.test(appId.trim())) {
      return {
        ...this.state,
        status: 'error',
        error: 'El App ID de Tiendanube debe ser numerico.',
      };
    }

    const attempt = ++this.oauthAttempt;
    this.state = { ...this.state, status: 'connecting', error: null };

    try {
      const { accessToken, storeId } = await this.runOAuthFlow(appId.trim(), clientSecret.trim());
      if (attempt !== this.oauthAttempt) return this.getState();
      this.accessToken = accessToken;
      this.state = {
        status: 'connected',
        storeId,
        lastSyncAt: null,
        productCount: 0,
        error: null,
        callbackUrl: OAUTH_CALLBACK_URL,
      };
      this.persistConnection(storeId, accessToken);
      const result = await this.syncProducts();
      this.startPolling();
      return result;
    } catch (err) {
      if (attempt !== this.oauthAttempt) return this.getState();
      this.state = {
        ...this.state,
        status: 'error',
        error: err instanceof Error ? err.message : 'OAuth failed',
      };
      return this.getState();
    }
  }

  /**
   * Connect using a direct access token from a Tiendanube "Aplicación a medida".
   * Skips OAuth entirely — the user provides store ID + token from their Tiendanube portal.
   */
  async connectDirect(storeId: string, accessToken: string): Promise<TiendanubeSyncState> {
    if (!/^\d+$/.test(storeId.trim())) {
      return { ...this.state, status: 'error', error: 'El ID de tienda debe ser numérico.' };
    }
    if (!accessToken.trim()) {
      return { ...this.state, status: 'error', error: 'El token de acceso no puede estar vacío.' };
    }

    this.state = { ...this.state, status: 'connecting', error: null };

    // Verify the token works by fetching store info
    const testUrl = `${TIENDANUBE_API_BASE}/${storeId.trim()}/store`;
    try {
      const res = await fetch(testUrl, {
        headers: { Authorization: `Bearer ${accessToken.trim()}`, 'User-Agent': USER_AGENT },
      });
      if (!res.ok) {
        this.state = {
          ...this.state,
          status: 'error',
          error: `Token inválido (${res.status}). Verifica el ID de tienda y el token.`,
        };
        return this.getState();
      }
    } catch (err) {
      this.state = { ...this.state, status: 'error', error: err instanceof Error ? err.message : 'Error de red' };
      return this.getState();
    }

    this.accessToken = accessToken.trim();
    this.state = {
      status: 'connected',
      storeId: storeId.trim(),
      lastSyncAt: null,
      productCount: 0,
      error: null,
      callbackUrl: OAUTH_CALLBACK_URL,
    };
    this.persistConnection(storeId.trim(), accessToken.trim());

    // Auto-sync then start background polling
    const result = await this.syncProducts();
    this.startPolling();
    return result;
  }

  /** Fetch all products from Tiendanube and upsert into local SQLite. */
  async syncProducts(): Promise<TiendanubeSyncState> {
    if (!this.accessToken || !this.state.storeId) {
      this.state = { ...this.state, status: 'error', error: 'No connection' };
      return this.getState();
    }

    this.state = { ...this.state, status: 'syncing', error: null };

    try {
      const [categoryMap, locationMap] = await Promise.all([
        this.fetchCategories(),
        this.fetchLocations(),
      ]);
      const products = await this.fetchAllProducts();
      const snapshots = this.mapToSnapshots(products, categoryMap, locationMap);

      // Remove previous Tiendanube products, then upsert the fresh set.
      const tx = this.db.transaction(() => {
        this.db.exec("DELETE FROM products WHERE id LIKE 'tn-%'");
        if (snapshots.length > 0) this.products.upsertMany(snapshots);
      });
      tx();

      const now = new Date().toISOString();
      this.lastDeltaAt = now;
      this.state = {
        ...this.state,
        status: 'connected',
        lastSyncAt: now,
        productCount: snapshots.length,
      };
      this.updateLastSync();
      this.broadcast('tiendanube:catalogUpdated', { productCount: snapshots.length, syncedAt: now });
      return this.getState();
    } catch (err) {
      this.state = {
        ...this.state,
        status: 'error',
        error: err instanceof Error ? err.message : 'Sync failed',
      };
      return this.getState();
    }
  }

  /** Remove the Tiendanube connection and its imported products. */
  disconnect(): TiendanubeSyncState {
    this.stopPolling();
    this.oauthAttempt++;
    this.abortOAuth?.();
    this.db.exec("DELETE FROM provider_connections WHERE provider = 'tiendanube'");
    this.db.exec("DELETE FROM products WHERE id LIKE 'tn-%'");
    this.accessToken = null;
    this.state = {
      status: 'disconnected',
      storeId: null,
      lastSyncAt: null,
      productCount: 0,
      error: null,
      callbackUrl: OAUTH_CALLBACK_URL,
    };
    return this.getState();
  }

  /** Check if we have an active Tiendanube connection. */
  isConnected(): boolean {
    return this.state.status === 'connected' || this.state.status === 'syncing';
  }

  // ── Private: OAuth flow ──────────────────────────────────────────────────

  private runOAuthFlow(appId: string, clientSecret: string): Promise<{ accessToken: string; storeId: string }> {
    return new Promise((resolve, reject) => {
      this.abortOAuth?.();

      let settled = false;
      const server = createServer(async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', OAUTH_CALLBACK_URL);
          if (url.pathname !== OAUTH_PATH) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
          }

          const oauthError = url.searchParams.get('error');
          if (oauthError) {
            const description = url.searchParams.get('error_description');
            throw new Error(description ? `${oauthError}: ${description}` : oauthError);
          }

          const code = url.searchParams.get('code');
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>Error: no se recibio el codigo de autorizacion</h1>');
            return;
          }

          const token = await this.exchangeCode(appId, clientSecret, code);
          const storeId = token.user_id ?? token.store_id;
          if (!token.access_token || storeId == null) {
            throw new Error('Tiendanube returned an incomplete access token response.');
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html lang="es"><body style="font-family:system-ui;text-align:center;padding:4rem;background:#f7f7f5;color:#18181b">
              <h1>Conectado a Tiendanube</h1>
              <p>Puedes cerrar esta ventana y volver a Retail OS.</p>
            </body></html>
          `);
          settle();
          resolve({ accessToken: token.access_token, storeId: String(storeId) });
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>Error al conectar</h1><p>${escapeHtml(errorMessage(err))}</p>`);
          settle();
          reject(err);
        }
      });

      const timeout = setTimeout(() => {
        settle();
        reject(
          new Error(
            `Tiendanube no redirigio a ${OAUTH_CALLBACK_URL}. Verifica la URL de redireccionamiento y que la tienda este habilitada para esta app en el Portal de Socios.`,
          ),
        );
      }, 90_000);

      const settle = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (server.listening) server.close();
        this.abortOAuth = null;
      };

      this.abortOAuth = () => {
        settle();
        reject(new Error('Autorizacion de Tiendanube cancelada.'));
      };

      server.once('error', (err) => {
        settle();
        reject(
          new Error(
            `Could not start the Tiendanube callback at ${OAUTH_CALLBACK_URL}: ${errorMessage(err)}`,
          ),
        );
      });

      server.listen(OAUTH_PORT, () => {
        // Tiendanube uses a restricted OAuth flow. The redirect URL is read
        // from the app registration and the documented install URL has no
        // redirect_uri or state query parameters.
        void shell.openExternal(
          `${TIENDANUBE_AUTH_BASE}/apps/${encodeURIComponent(appId)}/authorize`,
        );
      });
    });
  }

  private async exchangeCode(appId: string, clientSecret: string, code: string): Promise<TiendanubeTokenResponse> {
    const body = new URLSearchParams({
      client_id: appId,
      client_secret: clientSecret,
      code,
    });
    const res = await fetch(`${TIENDANUBE_AUTH_BASE}/apps/authorize/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const responseBody = await res.text();
    if (!res.ok) {
      throw new Error(
        `Tiendanube token exchange failed (${res.status}): ${extractApiError(responseBody)}`,
      );
    }

    try {
      return JSON.parse(responseBody) as TiendanubeTokenResponse;
    } catch {
      throw new Error('Tiendanube returned an invalid token response.');
    }
  }

  // ── Private: API fetchers ────────────────────────────────────────────────

  private async fetchLocations(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      const res = await this.apiGet(`/locations`);
      const locations = (await res.json()) as TiendanubeLocation[];
      for (const loc of locations) {
        const name = loc.name.es_AR ?? loc.name.es ?? Object.values(loc.name)[0] ?? 'Depósito';
        map.set(loc.id, name);
      }
    } catch {
      // locations endpoint may not be available on all plans
    }
    return map;
  }

  private async fetchCategories(): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    try {
      const res = await this.apiGet(`/categories`);
      const categories = (await res.json()) as TiendanubeCategory[];
      for (const cat of categories) {
        map.set(cat.id, cat.name.es ?? Object.values(cat.name)[0] ?? 'Sin categoria');
      }
    } catch {
      // categories scope may not be granted — products will use fallback category
    }
    return map;
  }

  private async fetchAllProducts(): Promise<TiendanubeProduct[]> {
    const all: TiendanubeProduct[] = [];
    let page = 1;
    while (true) {
      const res = await this.apiGet(`/products?per_page=200&page=${page}`);
      const batch = (await res.json()) as TiendanubeProduct[];
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < 200) break;
      page++;
      await sleep(500); // Respect 2 req/s rate limit
    }
    return all;
  }

  private async apiGet(path: string): Promise<Response> {
    const url = `${TIENDANUBE_API_BASE}/${this.state.storeId}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'User-Agent': USER_AGENT,
      },
    });
    if (!res.ok) throw new Error(`Tiendanube API error: ${res.status} ${res.statusText}`);
    return res;
  }

  // ── Private: product mapping ─────────────────────────────────────────────

  private mapToSnapshots(
    products: TiendanubeProduct[],
    categoryMap: Map<number, string>,
    locationMap: Map<string, string>,
  ): ProductSnapshot[] {
    const snapshots: ProductSnapshot[] = [];
    for (const product of products) {
      const categoryName =
        product.categories.length > 0
          ? categoryMap.get(product.categories[0].id) ?? 'Sin categoria'
          : 'Sin categoria';
      const productName = product.name.es ?? Object.values(product.name)[0] ?? '';
      const templateId = `tn-tmpl-${product.id}`;
      const coverImageUrl = product.images?.[0]?.src;

      for (const variant of (product.variants ?? [])) {
        const variantValues = (variant.values ?? [])
          .map((v) => v.es ?? v.en ?? '')
          .filter(Boolean);
        const variantDescription = variantValues.length > 0 ? variantValues.join(' / ') : undefined;

        // Stock: prefer inventory_levels (multi-location), fall back to legacy stock field
        let stockOnHand: number | undefined;
        let stockLocations: ProductSnapshot['stockLocations'];

        if (variant.stock_management) {
          if (variant.inventory_levels && variant.inventory_levels.length > 0) {
            stockLocations = variant.inventory_levels.map((lvl) => ({
              locationId: lvl.location_id,
              locationName: locationMap.get(lvl.location_id) ?? 'Depósito',
              stock: lvl.stock,
            }));
            stockOnHand = stockLocations.reduce((sum, l) => sum + l.stock, 0);
          } else if (variant.stock != null) {
            stockOnHand = variant.stock;
          }
        }

        snapshots.push({
          id: `tn-${product.id}-${variant.id}`,
          sku: variant.sku ?? `TN-${product.id}`,
          name: productName,
          barcode: variant.barcode ?? undefined,
          category: categoryName,
          priceMinorUnits: Math.round(parseFloat(variant.price ?? '0') * 100) || 0,
          currency: 'MXN',
          taxRatePercent: 16,
          trackInventory: variant.stock_management ?? false,
          active: product.published ?? true,
          templateId: product.variants.length > 1 ? templateId : undefined,
          variantDescription,
          imageUrl: coverImageUrl,
          stockOnHand,
          stockLocations,
        });
      }
    }
    return snapshots;
  }

  // ── Private: real-time polling ───────────────────────────────────────────

  private startPolling(): void {
    this.stopPolling();
    const timer = setInterval(() => void this.syncDelta(), POLL_INTERVAL_MS);
    // unref so the timer doesn't prevent the Electron process from exiting
    if (typeof timer === 'object' && 'unref' in timer) (timer as NodeJS.Timeout).unref();
    this.pollTimer = timer;
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Fetch only products updated since last sync and upsert them. */
  private async syncDelta(): Promise<void> {
    if (!this.accessToken || !this.state.storeId) return;
    if (this.state.status === 'syncing') return;

    const since = this.lastDeltaAt;
    if (!since) return;

    try {
      const [locationMap] = await Promise.all([this.fetchLocations()]);
      const updated = await this.fetchUpdatedProducts(since);
      if (updated.length === 0) return;

      const categoryMap = await this.fetchCategories();
      const snapshots = this.mapToSnapshots(updated, categoryMap, locationMap);

      // Upsert only the changed products — don't wipe the whole catalog
      if (snapshots.length > 0) this.products.upsertMany(snapshots);

      const now = new Date().toISOString();
      this.lastDeltaAt = now;
      this.state = {
        ...this.state,
        lastSyncAt: now,
        productCount: (this.db.prepare("SELECT COUNT(*) as cnt FROM products WHERE id LIKE 'tn-%'").get() as { cnt: number }).cnt,
      };
      this.updateLastSync();
      this.broadcast('tiendanube:catalogUpdated', { productCount: snapshots.length, syncedAt: now });
    } catch {
      // non-fatal: next poll will retry
    }
  }

  private async fetchUpdatedProducts(since: string): Promise<TiendanubeProduct[]> {
    const all: TiendanubeProduct[] = [];
    let page = 1;
    while (true) {
      const res = await this.apiGet(
        `/products?per_page=200&page=${page}&updated_at_min=${encodeURIComponent(since)}`,
      );
      const batch = (await res.json()) as TiendanubeProduct[];
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < 200) break;
      page++;
      await sleep(500);
    }
    return all;
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const wc of webContents.getAllWebContents()) {
      if (!wc.isDestroyed()) wc.send(channel, payload);
    }
  }

  // ── Private: persistence ─────────────────────────────────────────────────

  private loadExistingConnection(): void {
    const row = this.db
      .prepare("SELECT provider_account_id, encrypted_access_token, updated_at FROM provider_connections WHERE provider = 'tiendanube' AND status = 'active' LIMIT 1")
      .get() as { provider_account_id: string; encrypted_access_token: string; updated_at: string } | undefined;

    if (row) {
      this.accessToken = row.encrypted_access_token;
      const productCount = (this.db.prepare("SELECT COUNT(*) as cnt FROM products WHERE id LIKE 'tn-%'").get() as { cnt: number }).cnt;
      this.state = {
        status: 'connected',
        storeId: row.provider_account_id,
        lastSyncAt: row.updated_at,
        productCount,
        error: null,
        callbackUrl: OAUTH_CALLBACK_URL,
      };
      // Background re-sync then start polling
      void this.syncProducts().then(() => this.startPolling());
    }
  }

  private persistConnection(storeId: string, accessToken: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO provider_connections (id, tenant_id, provider, mode, status, encrypted_access_token, provider_account_id, created_at, updated_at)
         VALUES (@id, @tenantId, 'tiendanube', 'production', 'active', @token, @storeId, @now, @now)
         ON CONFLICT(tenant_id, provider, mode) DO UPDATE SET
           status='active', encrypted_access_token=@token, provider_account_id=@storeId, updated_at=@now`,
      )
      .run({
        id: `tn-conn-${storeId}`,
        tenantId: 'tenant-demo',
        token: accessToken,
        storeId,
        now,
      });
  }

  private updateLastSync(): void {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE provider_connections SET updated_at = ? WHERE provider = 'tiendanube' AND status = 'active'")
      .run(now);
  }
}

function extractApiError(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: string;
      error_description?: string;
      message?: string;
    };
    return parsed.error_description ?? parsed.message ?? parsed.error ?? body;
  } catch {
    return body || 'Unknown error';
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
