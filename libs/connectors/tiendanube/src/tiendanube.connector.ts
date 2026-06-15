import type {
  ConnectorCapabilities,
  ConnectorCredentials,
  ExternalOrderStatus,
  HealthCheck,
  OAuthStartResult,
  OrderConfirmation,
  PingResult,
  PriceItem,
  RawProduct,
  SellerOrderId,
  StockItem,
  WebhookRegistration,
} from '@retail-os/connector-contracts';
import type { IConnector } from '@retail-os/connector-contracts';
import { TiendanubeClient } from './tiendanube-client.js';
import type { TnProduct } from './tiendanube-client.js';

export class TiendanubeConnector implements IConnector {
  readonly connectorType = 'tiendanube';

  getCapabilities(): ConnectorCapabilities {
    return {
      supportsWebhooks: true,
      supportsReservation: false,     // TN has no reservation/hold API
      supportsDeliveryOptions: false, // delivery fetched separately
      supportsPartialStockLevels: true,
      minSyncIntervalSeconds: 300,    // 5 min minimum
    };
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async startOAuth(sellerId: string, redirectUri: string): Promise<OAuthStartResult> {
    const clientId = process.env.TIENDANUBE_CLIENT_ID;
    if (!clientId) throw new Error('TIENDANUBE_CLIENT_ID not configured');
    const state = `${sellerId}:${Date.now()}`;
    const authUrl =
      `https://www.tiendanube.com/apps/${clientId}/authorize` +
      `?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    return { authUrl, state };
  }

  async exchangeCode(
    _sellerId: string,
    code: string,
    _state: string,
  ): Promise<ConnectorCredentials> {
    const clientId = process.env.TIENDANUBE_CLIENT_ID!;
    const clientSecret = process.env.TIENDANUBE_CLIENT_SECRET!;

    const res = await fetch('https://www.tiendanube.com/apps/authorize/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!res.ok) throw new Error(`TN token exchange failed: ${res.status}`);

    const data = await res.json() as {
      access_token: string; user_id: string;
    };

    return {
      accessToken: data.access_token,
      storeId: String(data.user_id),
      userId: String(data.user_id),
    };
  }

  async validateCredentials(sellerId: string): Promise<HealthCheck> {
    const client = await this.clientFor(sellerId);
    try {
      await client.getStore();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  }

  async refreshCredentials(sellerId: string): Promise<ConnectorCredentials> {
    // Tiendanube tokens don't expire — return existing credentials
    return this.loadCreds(sellerId);
  }

  // ─── Catalog ──────────────────────────────────────────────────────────────

  async *fetchCatalog(sellerId: string): AsyncGenerator<RawProduct[]> {
    const client = await this.clientFor(sellerId);
    let page = 1;

    while (true) {
      const { products, nextPage } = await client.getProducts(page);
      if (products.length === 0) break;

      yield products.map((p) => this.toRawProduct(p));

      if (!nextPage) break;
      page = nextPage;
      await sleep(500); // respect rate limits between pages
    }
  }

  // ─── Inventory ────────────────────────────────────────────────────────────

  async fetchInventory(sellerId: string, _externalIds?: string[]): Promise<StockItem[]> {
    const client = await this.clientFor(sellerId);
    const items: StockItem[] = [];
    let page = 1;

    while (true) {
      const { products, nextPage } = await client.getProducts(page);
      if (products.length === 0) break;

      for (const p of products) {
        for (const v of p.variants) {
          const stock = v.stock_management ? (v.stock ?? 0) : 999;
          items.push({
            externalId: String(v.id),
            sku: v.sku ?? undefined,
            stock,
            status: stock === 0 ? 'out_of_stock' : stock <= 3 ? 'low_stock' : 'in_stock',
          });
        }
      }

      if (!nextPage) break;
      page = nextPage;
      await sleep(300);
    }

    return items;
  }

  async subscribeInventory(
    sellerId: string,
    callbackUrl: string,
  ): Promise<WebhookRegistration> {
    const client = await this.clientFor(sellerId);
    const webhook = await client.registerWebhook('product/updated', callbackUrl);
    return {
      webhookId: String(webhook.id),
      topic: 'product/updated',
      callbackUrl,
    };
  }

  async unsubscribeInventory(sellerId: string, webhookId: string): Promise<void> {
    const client = await this.clientFor(sellerId);
    await client.deleteWebhook(Number(webhookId));
  }

  // ─── Prices ───────────────────────────────────────────────────────────────

  async fetchPrices(sellerId: string): Promise<PriceItem[]> {
    const client = await this.clientFor(sellerId);
    const items: PriceItem[] = [];
    let page = 1;

    while (true) {
      const { products, nextPage } = await client.getProducts(page);
      if (products.length === 0) break;

      for (const p of products) {
        for (const v of p.variants) {
          items.push({
            externalId: String(v.id),
            sku: v.sku ?? undefined,
            priceMinorUnits: Math.round(parseFloat(v.price) * 100),
            originalPriceMinorUnits: v.compare_at_price
              ? Math.round(parseFloat(v.compare_at_price) * 100)
              : undefined,
            currency: 'ARS', // TN defaults to seller's store currency
          });
        }
      }

      if (!nextPage) break;
      page = nextPage;
      await sleep(300);
    }

    return items;
  }

  // ─── Orders ───────────────────────────────────────────────────────────────
  // Tiendanube doesn't support reservation. Orders are placed via their checkout.
  // We notify the seller out-of-band and track via our own order system.

  async confirmOrder(
    _sellerId: string,
    order: OrderConfirmation,
  ): Promise<SellerOrderId> {
    // For TN sellers without reservation, we use our own order ID as the reference.
    // In a future version this could create a draft order via TN API if they add it.
    return { externalOrderId: order.marketplaceOrderId };
  }

  async fetchOrderStatus(
    _sellerId: string,
    externalOrderId: string,
  ): Promise<ExternalOrderStatus> {
    return { externalOrderId, status: 'confirmed' };
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  async ping(sellerId: string): Promise<PingResult> {
    const start = Date.now();
    const check = await this.validateCredentials(sellerId);
    return { ok: check.ok, latencyMs: Date.now() - start, message: check.message };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async clientFor(sellerId: string): Promise<TiendanubeClient> {
    const creds = await this.loadCreds(sellerId);
    return new TiendanubeClient({
      accessToken: creds.accessToken!,
      storeId: creds.storeId!,
      userId: creds.userId as string,
    });
  }

  // In production this will decrypt credentials from DB.
  // Injected from the NestJS connector registry service.
  private loadCreds: (sellerId: string) => Promise<ConnectorCredentials>;

  constructor(loader: (sellerId: string) => Promise<ConnectorCredentials>) {
    this.loadCreds = loader;
  }

  private toRawProduct(p: TnProduct): RawProduct {
    const name = p.name.es ?? p.name.pt ?? Object.values(p.name)[0] ?? '';
    const description = p.description.es ?? p.description.pt ?? Object.values(p.description)[0];
    const images = p.images
      .sort((a, b) => a.position - b.position)
      .map((i) => i.src);

    return {
      externalId: String(p.id),
      name,
      description,
      images,
      category: p.categories[0]?.name?.es ?? 'board-game',
      tags: p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      url: p.canonical_url,
      variants: p.variants.map((v) => ({
        externalId: String(v.id),
        sku: v.sku ?? undefined,
        name: v.values.map((val) => val.es ?? Object.values(val)[0] ?? '').join(' / '),
        priceMinorUnits: Math.round(parseFloat(v.price) * 100),
        currency: 'ARS',
        stock: v.stock_management ? (v.stock ?? 0) : 999,
        attributes: {},
      })),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
