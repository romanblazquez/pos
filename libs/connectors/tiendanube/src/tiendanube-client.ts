// Tiendanube (Nuvemshop) REST API v1 client.
// Docs: https://tiendanube.github.io/api-documentation/

export interface TiendanubeCredentials {
  accessToken: string;
  storeId: string;
  userId: string;
}

export interface TnProduct {
  id: number;
  name: Record<string, string>;           // { es: 'name', ... }
  description: Record<string, string>;
  images: { id: number; src: string; position: number }[];
  variants: TnVariant[];
  categories: { id: number; name: Record<string, string> }[];
  tags: string;
  brand?: string;
  canonical_url?: string;
  created_at: string;
  updated_at: string;
  published: boolean;
}

export interface TnVariant {
  id: number;
  product_id: number;
  price: string;           // decimal string e.g. "4200.00"
  compare_at_price: string | null;
  stock_management: boolean;
  stock: number | null;
  sku: string | null;
  values: { es?: string; [lang: string]: string | undefined }[];
}

export interface TnWebhook {
  id: number;
  url: string;
  event: string;
  created_at: string;
}

const BASE = 'https://api.tiendanube.com/v1';
const APP_USER_AGENT = 'BoardGameMarket/1.0 (soporte@boardgamemarket.com)';

export class TiendanubeClient {
  constructor(private readonly creds: TiendanubeCredentials) {}

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const res = await fetch(`${BASE}/${this.creds.storeId}${path}`, {
      method,
      headers: {
        'Authentication': `bearer ${this.creds.accessToken}`,
        'User-Agent': APP_USER_AGENT,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429) {
      // Rate-limited: wait and retry once
      const retryAfter = Number(res.headers.get('Retry-After') ?? 5) * 1000;
      await new Promise((r) => setTimeout(r, retryAfter));
      return this.req<T>(method, path, body, extraHeaders);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Tiendanube ${method} ${path} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getStore(): Promise<{ id: number; name: string; url: string }> {
    return this.req('GET', '');
  }

  // Returns Link header for pagination: <url>; rel="next"
  async getProducts(page = 1, perPage = 200): Promise<{ products: TnProduct[]; nextPage: number | null }> {
    const res = await fetch(
      `${BASE}/${this.creds.storeId}/products?page=${page}&per_page=${perPage}&published=true`,
      {
        headers: {
          'Authentication': `bearer ${this.creds.accessToken}`,
          'User-Agent': APP_USER_AGENT,
        },
      },
    );

    if (!res.ok) throw new Error(`Tiendanube products → ${res.status}`);

    const products = await res.json() as TnProduct[];
    const link = res.headers.get('Link') ?? '';
    const hasNext = link.includes('rel="next"');

    return { products, nextPage: hasNext ? page + 1 : null };
  }

  async getVariants(productId: number): Promise<TnVariant[]> {
    return this.req('GET', `/products/${productId}/variants`);
  }

  async registerWebhook(event: string, url: string): Promise<TnWebhook> {
    return this.req('POST', '/webhooks', { url, event });
  }

  async deleteWebhook(webhookId: number): Promise<void> {
    await this.req('DELETE', `/webhooks/${webhookId}`);
  }

  async listWebhooks(): Promise<TnWebhook[]> {
    return this.req('GET', '/webhooks');
  }
}
