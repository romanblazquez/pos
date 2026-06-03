import { createServer, type Server } from 'node:http';
import { shell } from 'electron';
import { ProductRepository, type Db } from '@retail-os/local-db';
import type { ProductSnapshot } from '@retail-os/catalog';

// ── Tiendanube API types ─────────────────────────────────────────────────────

interface TiendanubeTokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  scope: string;
}

interface TiendanubeProduct {
  id: number;
  name: Record<string, string>;
  published: boolean;
  categories: Array<{ id: number }>;
  variants: TiendanubeVariant[];
}

interface TiendanubeVariant {
  id: number;
  sku: string | null;
  barcode: string | null;
  price: string;
  stock_management: boolean;
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
}

const TIENDANUBE_AUTH_BASE = 'https://www.tiendanube.com';
const TIENDANUBE_API_BASE = 'https://api.tiendanube.com/v1';
const USER_AGENT = 'RetailOS (pos@retailos.dev)';

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
  };

  private accessToken: string | null = null;
  private oauthServer: Server | null = null;

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

    this.state = { ...this.state, status: 'connecting', error: null };

    try {
      const { accessToken, storeId } = await this.runOAuthFlow(appId, clientSecret);
      this.accessToken = accessToken;
      this.state = {
        status: 'connected',
        storeId,
        lastSyncAt: null,
        productCount: 0,
        error: null,
      };
      this.persistConnection(storeId, accessToken);
      return this.getState();
    } catch (err) {
      this.state = {
        ...this.state,
        status: 'error',
        error: err instanceof Error ? err.message : 'OAuth failed',
      };
      return this.getState();
    }
  }

  /** Fetch all products from Tiendanube and upsert into local SQLite. */
  async syncProducts(): Promise<TiendanubeSyncState> {
    if (!this.accessToken || !this.state.storeId) {
      this.state = { ...this.state, status: 'error', error: 'No connection' };
      return this.getState();
    }

    this.state = { ...this.state, status: 'syncing', error: null };

    try {
      const categoryMap = await this.fetchCategories();
      const products = await this.fetchAllProducts();
      const snapshots = this.mapToSnapshots(products, categoryMap);

      // Remove previous Tiendanube products, then upsert the fresh set.
      const tx = this.db.transaction(() => {
        this.db.exec("DELETE FROM products WHERE id LIKE 'tn-%'");
        if (snapshots.length > 0) this.products.upsertMany(snapshots);
      });
      tx();

      this.state = {
        ...this.state,
        status: 'connected',
        lastSyncAt: new Date().toISOString(),
        productCount: snapshots.length,
      };
      this.updateLastSync();
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
    if (this.oauthServer?.listening) {
      this.oauthServer.close();
      this.oauthServer = null;
    }
    this.db.exec("DELETE FROM provider_connections WHERE provider = 'tiendanube'");
    this.db.exec("DELETE FROM products WHERE id LIKE 'tn-%'");
    this.accessToken = null;
    this.state = { status: 'disconnected', storeId: null, lastSyncAt: null, productCount: 0, error: null };
    return this.getState();
  }

  /** Check if we have an active Tiendanube connection. */
  isConnected(): boolean {
    return this.state.status === 'connected' || this.state.status === 'syncing';
  }

  // ── Private: OAuth flow ──────────────────────────────────────────────────

  private runOAuthFlow(appId: string, clientSecret: string): Promise<{ accessToken: string; storeId: string }> {
    return new Promise((resolve, reject) => {
      const server = createServer(async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', `http://localhost`);
          const code = url.searchParams.get('code');
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>Error: no se recibio codigo de autorizacion</h1>');
            return;
          }

          const token = await this.exchangeCode(appId, clientSecret, code);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html><body style="font-family:system-ui;text-align:center;padding:4rem">
              <h1>Conectado a Tiendanube</h1>
              <p>Puedes cerrar esta ventana y volver a Retail OS.</p>
            </body></html>
          `);
          cleanup();
          resolve({ accessToken: token.access_token, storeId: String(token.user_id) });
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>Error al conectar</h1>');
          cleanup();
          reject(err);
        }
      });

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('OAuth timeout — no response within 2 minutes'));
      }, 120_000);

      const cleanup = () => {
        clearTimeout(timeout);
        if (!server.listening) return;
        server.close();
        this.oauthServer = null;
      };

      this.oauthServer = server;

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        const redirectUri = `http://localhost:${addr.port}/callback`;
        const authUrl = `${TIENDANUBE_AUTH_BASE}/apps/${encodeURIComponent(appId)}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`;
        void shell.openExternal(authUrl);
      });
    });
  }

  private async exchangeCode(appId: string, clientSecret: string, code: string): Promise<TiendanubeTokenResponse> {
    const res = await fetch(`${TIENDANUBE_AUTH_BASE}/apps/authorize/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: appId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
      }),
    });
    if (!res.ok) throw new Error(`Token exchange failed: HTTP ${res.status}`);
    return res.json() as Promise<TiendanubeTokenResponse>;
  }

  // ── Private: API fetchers ────────────────────────────────────────────────

  private async fetchCategories(): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const res = await this.apiGet(`/categories`);
    const categories = (await res.json()) as TiendanubeCategory[];
    for (const cat of categories) {
      map.set(cat.id, cat.name.es ?? Object.values(cat.name)[0] ?? 'Sin categoria');
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
  ): ProductSnapshot[] {
    const snapshots: ProductSnapshot[] = [];
    for (const product of products) {
      const categoryName =
        product.categories.length > 0
          ? categoryMap.get(product.categories[0].id) ?? 'Sin categoria'
          : 'Sin categoria';
      const productName = product.name.es ?? Object.values(product.name)[0] ?? '';

      for (const variant of product.variants) {
        snapshots.push({
          id: `tn-${product.id}-${variant.id}`,
          sku: variant.sku ?? `TN-${product.id}`,
          name: productName,
          barcode: variant.barcode ?? undefined,
          category: categoryName,
          priceMinorUnits: Math.round(parseFloat(variant.price) * 100),
          currency: 'MXN',
          taxRatePercent: 16,
          trackInventory: variant.stock_management ?? false,
          active: product.published ?? true,
        });
      }
    }
    return snapshots;
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
      };
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
